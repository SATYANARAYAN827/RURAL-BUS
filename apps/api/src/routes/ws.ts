import { FastifyInstance } from 'fastify';
import {
  subscribeToTrip,
  unsubscribeFromTrip,
  subscribeToFleet,
  unsubscribeFromFleet,
  cleanupSocket,
  processGpsPing,
} from '../services/telemetry.service.js';
import { gpsPingSchema, wsMessageSchema } from '@ruralbus/shared-validators';
import type { WebSocketMessage } from '@ruralbus/shared-types';

export async function websocketRoutes(app: FastifyInstance) {
  app.get('/ws/tracking', { websocket: true }, (socket, req) => {
    let authUser: { sub: string; role: string; tenantId: string | null } | null = null;

    // Check token from query param ?token=... or header
    const token = (req.query as any)?.token;
    if (token) {
      try {
        const decoded = app.jwt.verify(token) as any;
        authUser = {
          sub: decoded.sub,
          role: decoded.role,
          tenantId: decoded.tenantId ?? null,
        };
      } catch {
        socket.send(
          JSON.stringify({
            type: 'ERROR',
            error: 'Authentication failed: invalid token in query',
          })
        );
      }
    }

    socket.on('message', async (data: Buffer | string) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        const parsed = wsMessageSchema.safeParse(message);
        if (!parsed.success) {
          socket.send(
            JSON.stringify({
              type: 'ERROR',
              error: 'Invalid message structure',
            })
          );
          return;
        }

        switch (message.type) {
          case 'PING':
            socket.send(JSON.stringify({ type: 'PONG', payload: { timestamp: Date.now() } }));
            break;

          case 'SUBSCRIBE_TRIP': {
            const tripId = message.payload?.tripId;
            if (tripId) {
              subscribeToTrip(tripId, socket);
              socket.send(
                JSON.stringify({
                  type: 'TRIP_LOCATION_UPDATE',
                  payload: { subscribedTripId: tripId, status: 'SUBSCRIBED' },
                })
              );
            }
            break;
          }

          case 'UNSUBSCRIBE_TRIP': {
            const tripId = message.payload?.tripId;
            if (tripId) {
              unsubscribeFromTrip(tripId, socket);
            }
            break;
          }

          case 'SUBSCRIBE_FLEET': {
            // Operator admin or tenant member only
            if (!authUser?.tenantId) {
              socket.send(
                JSON.stringify({
                  type: 'ERROR',
                  error: 'Authentication required: must be an authenticated tenant member to subscribe to fleet radar',
                })
              );
              break;
            }
            const targetTenantId = authUser.tenantId;
            subscribeToFleet(targetTenantId, socket);
            socket.send(
              JSON.stringify({
                type: 'FLEET_RADAR_UPDATE',
                payload: { subscribedTenantId: targetTenantId, status: 'SUBSCRIBED' },
              })
            );
            break;
          }

          case 'UNSUBSCRIBE_FLEET': {
            const targetTenantId = authUser?.tenantId;
            if (targetTenantId) {
              unsubscribeFromFleet(targetTenantId, socket);
            }
            break;
          }

          case 'GPS_PING': {
            if (!authUser || authUser.role !== 'DRIVER' || !authUser.tenantId) {
              socket.send(
                JSON.stringify({
                  type: 'ERROR',
                  error: 'Unauthorized: Driver authentication and tenant context required for GPS_PING',
                })
              );
              return;
            }

            const pingResult = gpsPingSchema.safeParse(message.payload);
            if (!pingResult.success) {
              socket.send(
                JSON.stringify({
                  type: 'ERROR',
                  error: pingResult.error.errors[0]?.message || 'Invalid GPS coordinates',
                })
              );
              return;
            }

            const { tripLocation } = await processGpsPing(
              authUser.tenantId,
              authUser.sub,
              pingResult.data
            );

            socket.send(
              JSON.stringify({
                type: 'TRIP_LOCATION_UPDATE',
                payload: tripLocation,
              })
            );
            break;
          }

          default:
            break;
        }
      } catch (err: any) {
        socket.send(
          JSON.stringify({
            type: 'ERROR',
            error: err.message || 'Internal server error in tracking socket',
          })
        );
      }
    });

    socket.on('close', () => {
      cleanupSocket(socket);
    });

    socket.on('error', () => {
      cleanupSocket(socket);
    });
  });
}

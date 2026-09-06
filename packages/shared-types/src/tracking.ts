export interface GPSTelemetryPayload {
  tripId: string;
  busId: string;
  tenantId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDegrees: number;
  accuracyMeters: number;
  timestamp: number;
}

export interface LiveBusLocationBroadcast {
  tripId: string;
  busId: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDegrees: number;
  timestamp: number;
  nextStopId?: string;
  etaMinutes?: number;
}

export type WebSocketClientRole = 'DRIVER' | 'PASSENGER' | 'OPERATOR_ADMIN';

export type WebSocketTrackingEvent =
  | { type: 'DRIVER_GPS_PING'; payload: GPSTelemetryPayload }
  | { type: 'LIVE_BUS_UPDATE'; payload: LiveBusLocationBroadcast }
  | { type: 'SUBSCRIBE_TRIP'; payload: { tripId: string } }
  | { type: 'UNSUBSCRIBE_TRIP'; payload: { tripId: string } }
  | { type: 'ERROR'; payload: { message: string; code: string } };

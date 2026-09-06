import { FastifyInstance } from 'fastify';
import {
  searchAvailableTrips,
  getPublicStops,
  getPublicTripDetail,
} from '../services/discovery.service.js';
import {
  routeSearchQuerySchema,
  tripDetailParamSchema,
} from '@ruralbus/shared-validators';

export async function discoveryRoutes(app: FastifyInstance) {
  // Public Route Search
  app.get('/api/v1/discovery/routes', async (request, reply) => {
    const params = routeSearchQuerySchema.parse(request.query);
    const searchResult = await searchAvailableTrips(params);

    return reply.code(200).send({
      success: true,
      data: searchResult,
    });
  });

  // Public Stops Autocomplete / Directory
  app.get('/api/v1/discovery/stops', async (request, reply) => {
    const query = (request.query as any)?.q;
    const stopsList = await getPublicStops(query);

    return reply.code(200).send({
      success: true,
      data: { stops: stopsList },
    });
  });

  // Public Trip Detail with Stops & Live Location
  app.get('/api/v1/discovery/trips/:tripId', async (request, reply) => {
    const { tripId } = tripDetailParamSchema.parse(request.params);
    const tripDetail = await getPublicTripDetail(tripId);

    return reply.code(200).send({
      success: true,
      data: tripDetail,
    });
  });
}

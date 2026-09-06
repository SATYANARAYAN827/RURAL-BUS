import { and, eq, gte, inArray, sql, or, ilike } from 'drizzle-orm';
import {
  withSystemContext,
  trips,
  routes,
  buses,
  stops,
  operators,
} from '@ruralbus/database';
import { NotFoundError } from '../errors/AppError.js';
import { getTripLiveLocation } from './telemetry.service.js';
import type {
  RouteSearchParams,
  RouteSearchResult,
  AvailableTripResult,
  PublicStopItem,
  PublicTripDetailResponse,
  RouteStopDutyInfo,
} from '@ruralbus/shared-types';

/**
 * Public search for upcoming trips matching origin and destination corridor.
 */
export async function searchAvailableTrips(params: RouteSearchParams): Promise<RouteSearchResult> {
  return await withSystemContext(async (tx) => {
    // 1. Query active trips scheduled or in transit
    const query = tx
      .select({
        tripId: trips.id,
        tenantId: trips.tenantId,
        operatorName: operators.companyName,
        routeId: routes.id,
        routeCode: routes.routeCode,
        origin: routes.origin,
        destination: routes.destination,
        stopsData: routes.stopsData,
        busId: buses.id,
        busRegistration: buses.registrationNumber,
        busModel: buses.model,
        seatingType: buses.seatingType,
        totalSeats: buses.totalSeats,
        departureTime: trips.departureTime,
        scheduledArrival: trips.scheduledArrival,
        status: trips.status,
        availableSeats: trips.availableSeats,
      })
      .from(trips)
      .innerJoin(routes, eq(trips.routeId, routes.id))
      .innerJoin(buses, eq(trips.busId, buses.id))
      .innerJoin(operators, eq(trips.tenantId, operators.id))
      .where(
        and(
          inArray(trips.status, ['SCHEDULED', 'BOARDING', 'IN_TRANSIT']),
          gte(trips.departureTime, new Date(Date.now() - 3600 * 1000 * 2)) // trips departing within past 2 hours or in the future
        )
      )
      .orderBy(trips.departureTime);

    const tripRows = await query;

    const matchedTrips: AvailableTripResult[] = [];

    const originQueryLower = (params.origin || '').trim().toLowerCase();
    const destQueryLower = (params.destination || '').trim().toLowerCase();

    for (const row of tripRows) {
      const stopsList = (row.stopsData as any[]) || [];
      if (stopsList.length < 2) continue;

      let originStopIndex = -1;
      let destStopIndex = -1;

      // Match by stop ID or stop name
      for (let i = 0; i < stopsList.length; i++) {
        const s = stopsList[i];
        const sName = (s.stopName || '').toLowerCase();
        const sId = s.stopId;

        if (
          (params.originStopId && sId === params.originStopId) ||
          (originQueryLower && sName.includes(originQueryLower)) ||
          (!params.originStopId && !originQueryLower && i === 0)
        ) {
          if (originStopIndex === -1) originStopIndex = i;
        }

        if (
          (params.destinationStopId && sId === params.destinationStopId) ||
          (destQueryLower && sName.includes(destQueryLower)) ||
          (!params.destinationStopId && !destQueryLower && i === stopsList.length - 1)
        ) {
          destStopIndex = i;
        }
      }

      // Valid directional corridor: Origin must precede Destination in sequence
      if (originStopIndex >= 0 && destStopIndex > originStopIndex) {
        const startStop = stopsList[originStopIndex];
        const endStop = stopsList[destStopIndex];

        // Calculate segment fare: fare to end stop minus fare to start stop (or default fare)
        const fareStart = startStop.fareFromStart ?? 0;
        const fareEnd = endStop.fareFromStart ?? 40;
        const fareAmount = Math.max(fareEnd - fareStart, 15);

        const liveLoc = await getTripLiveLocation(row.tripId);

        const formattedStops: RouteStopDutyInfo[] = stopsList.map((s) => ({
          stopId: s.stopId,
          stopName: s.stopName,
          sequenceNumber: s.sequenceNumber,
          distanceFromStartKm: s.distanceFromStartKm ?? 0,
          estimatedMinutesFromStart: s.estimatedMinutesFromStart ?? 0,
          latitude: s.location?.latitude ?? 0,
          longitude: s.location?.longitude ?? 0,
        }));

        matchedTrips.push({
          tripId: row.tripId,
          routeId: row.routeId,
          routeCode: row.routeCode,
          origin: row.origin,
          destination: row.destination,
          operatorId: row.tenantId,
          operatorName: row.operatorName,
          busId: row.busId,
          busRegistrationNumber: row.busRegistration,
          busModel: row.busModel,
          seatingType: row.seatingType,
          departureTime: row.departureTime.toISOString(),
          scheduledArrival: row.scheduledArrival.toISOString(),
          totalSeats: row.totalSeats,
          availableSeats: row.availableSeats,
          fareAmount,
          originStop: {
            stopId: startStop.stopId,
            stopName: startStop.stopName,
            sequenceNumber: startStop.sequenceNumber,
            estimatedMinutesFromStart: startStop.estimatedMinutesFromStart ?? 0,
          },
          destinationStop: {
            stopId: endStop.stopId,
            stopName: endStop.stopName,
            sequenceNumber: endStop.sequenceNumber,
            estimatedMinutesFromStart: endStop.estimatedMinutesFromStart ?? 60,
          },
          stops: formattedStops,
          status: row.status,
          hasLiveGps: !!liveLoc,
        });
      }
    }

    return {
      trips: matchedTrips,
      totalCount: matchedTrips.length,
    };
  });
}

/**
 * Returns all active public stops for pickers / autocomplete.
 * Strictly restricted to stops that belong to currently active/scheduled/published trips.
 * If zero trips exist, zero stops are publicly discoverable.
 */
export async function getPublicStops(searchQuery?: string): Promise<PublicStopItem[]> {
  return await withSystemContext(async (tx) => {
    // 1. Find all active/scheduled trips
    const activeTrips = await tx
      .select({
        stopsData: routes.stopsData,
      })
      .from(trips)
      .innerJoin(routes, eq(trips.routeId, routes.id))
      .where(
        inArray(trips.status, ['SCHEDULED', 'BOARDING', 'IN_TRANSIT'])
      );

    if (activeTrips.length === 0) {
      return [];
    }

    // 2. Extract stop IDs from stopsData of active trips
    const stopIds = new Set<string>();
    for (const t of activeTrips) {
      const stopsList = (t.stopsData as any[]) || [];
      for (const s of stopsList) {
        if (s.stopId) stopIds.add(s.stopId);
      }
    }

    if (stopIds.size === 0) {
      return [];
    }

    const stopIdList = Array.from(stopIds);

    // 3. Query stops table strictly for stops associated with active trips
    let query = tx
      .select({
        id: stops.id,
        name: stops.name,
        code: stops.code,
        latitude: stops.latitude,
        longitude: stops.longitude,
        tenantId: stops.tenantId,
      })
      .from(stops)
      .where(inArray(stops.id, stopIdList));

    if (searchQuery && searchQuery.trim().length > 0) {
      query = tx
        .select({
          id: stops.id,
          name: stops.name,
          code: stops.code,
          latitude: stops.latitude,
          longitude: stops.longitude,
          tenantId: stops.tenantId,
        })
        .from(stops)
        .where(
          and(
            inArray(stops.id, stopIdList),
            or(
              ilike(stops.name, `%${searchQuery.trim()}%`),
              ilike(stops.code, `%${searchQuery.trim()}%`)
            )
          ) as any
        );
    }

    return await query.orderBy(stops.name);
  });
}

/**
 * Returns detailed public itinerary and live tracking data for a specific trip.
 */
export async function getPublicTripDetail(tripId: string): Promise<PublicTripDetailResponse> {
  const result = await searchAvailableTrips({});
  const trip = result.trips.find((t) => t.tripId === tripId);

  if (!trip) {
    throw new NotFoundError('Trip not found or is no longer active');
  }

  const liveRes = await getTripLiveLocation(tripId);
  const liveLoc = liveRes.location;

  return {
    trip,
    liveLocation: liveLoc
      ? {
          latitude: liveLoc.latitude,
          longitude: liveLoc.longitude,
          speed: liveLoc.speed,
          heading: liveLoc.heading,
          lastPingAt: liveLoc.lastUpdated,
        }
      : null,
  };
}

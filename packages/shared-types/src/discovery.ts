import type { RouteStopDutyInfo } from './duty.js';

export interface RouteSearchParams {
  originStopId?: string;
  destinationStopId?: string;
  origin?: string;
  destination?: string;
  date?: string;
}

export interface AvailableTripResult {
  tripId: string;
  routeId: string;
  routeCode: string;
  origin: string;
  destination: string;
  operatorId: string;
  operatorName: string;
  busId: string;
  busRegistrationNumber: string;
  busModel: string;
  seatingType: string;
  departureTime: string;
  scheduledArrival: string;
  totalSeats: number;
  availableSeats: number;
  fareAmount: number;
  originStop: {
    stopId: string;
    stopName: string;
    sequenceNumber: number;
    estimatedMinutesFromStart: number;
  };
  destinationStop: {
    stopId: string;
    stopName: string;
    sequenceNumber: number;
    estimatedMinutesFromStart: number;
  };
  stops: RouteStopDutyInfo[];
  status: string;
  hasLiveGps: boolean;
}

export interface RouteSearchResult {
  trips: AvailableTripResult[];
  totalCount: number;
}

export interface PublicStopItem {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  tenantId: string;
}

export interface PublicTripDetailResponse {
  trip: AvailableTripResult;
  liveLocation?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    lastPingAt: string;
    etaMinutesToNextStop?: number;
  } | null;
}

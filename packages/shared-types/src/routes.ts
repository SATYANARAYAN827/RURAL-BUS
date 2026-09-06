export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface Stop {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  location: GeoCoordinates;
  landmark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStopInput {
  name: string;
  code: string;
  location: GeoCoordinates;
  landmark?: string;
}

export interface UpdateStopInput {
  name?: string;
  code?: string;
  location?: GeoCoordinates;
  landmark?: string;
}

export interface StopListResponse {
  stops: Stop[];
  total: number;
}

export interface RouteStop {
  stopId: string;
  stopName: string;
  sequenceNumber: number;
  distanceFromStartKm: number;
  estimatedMinutesFromStart: number;
  fareFromStart: number;
  location?: GeoCoordinates;
}

export interface Route {
  id: string;
  tenantId: string;
  routeCode: string;
  origin: string;
  destination: string;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  polylineCoordinates: GeoCoordinates[];
  stops: RouteStop[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRouteStopInput {
  stopId: string;
  sequenceNumber: number;
  distanceFromStartKm: number;
  estimatedMinutesFromStart: number;
  fareFromStart: number;
}

export interface CreateRouteInput {
  routeCode: string;
  origin: string;
  destination: string;
  stops: CreateRouteStopInput[];
  polylineCoordinates?: GeoCoordinates[];
}

export interface UpdateRouteInput {
  routeCode?: string;
  origin?: string;
  destination?: string;
  stops?: CreateRouteStopInput[];
  polylineCoordinates?: GeoCoordinates[];
  isActive?: boolean;
}

export interface RouteListResponse {
  routes: Route[];
  total: number;
}

export interface RouteDetailsResponse {
  route: Route;
}

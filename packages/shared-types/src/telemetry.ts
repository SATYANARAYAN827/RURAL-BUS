export interface GpsPingPayload {
  tripId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp?: number;
}

export interface LiveTripLocation {
  tripId: string;
  busId: string;
  routeCode: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: number;
  lastUpdated: string;
  nextStopName?: string;
  etaMinutes?: number;
}

export interface LiveFleetBus {
  busId: string;
  registrationNumber: string;
  tripId: string;
  routeCode: string;
  driverName: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  lastPingAt: string;
  status: 'IN_TRANSIT' | 'BOARDING' | 'SCHEDULED' | 'IDLE';
}

export interface LiveFleetRadarResponse {
  tenantId: string;
  buses: LiveFleetBus[];
  totalActive: number;
  lastUpdated: string;
}

export type WebSocketMessageType =
  | 'GPS_PING'
  | 'SUBSCRIBE_TRIP'
  | 'UNSUBSCRIBE_TRIP'
  | 'SUBSCRIBE_FLEET'
  | 'UNSUBSCRIBE_FLEET'
  | 'TRIP_LOCATION_UPDATE'
  | 'FLEET_RADAR_UPDATE'
  | 'PING'
  | 'PONG'
  | 'ERROR';

export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  payload?: T;
  error?: string;
}

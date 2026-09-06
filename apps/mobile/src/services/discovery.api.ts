import axios from 'axios';
import type {
  RouteSearchResult,
  PublicStopItem,
  PublicTripDetailResponse,
  RouteSearchParams,
} from '@ruralbus/shared-types';

const API_URL = 'http://localhost:4000';

export async function searchTrips(params: RouteSearchParams): Promise<RouteSearchResult> {
  const res = await axios.get(`${API_URL}/api/v1/discovery/routes`, { params });
  return res.data.data;
}

export async function getStops(query?: string): Promise<PublicStopItem[]> {
  const res = await axios.get(`${API_URL}/api/v1/discovery/stops`, { params: { q: query } });
  return res.data.data.stops;
}

export async function getTripDetails(tripId: string): Promise<PublicTripDetailResponse> {
  const res = await axios.get(`${API_URL}/api/v1/discovery/trips/${tripId}`);
  return res.data.data;
}

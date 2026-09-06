import axios from 'axios';
import { useAuthStore } from '../stores/auth.store.js';
import type {
  TripSeatMapResponse,
  SeatHoldRequest,
  SeatHoldResponse,
  PassengerBookingsResponse,
} from '@ruralbus/shared-types';

const API_URL = 'http://localhost:4000';

function getAuthHeader() {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchSeatMap(tripId: string): Promise<TripSeatMapResponse> {
  const res = await axios.get(`${API_URL}/api/v1/bookings/trips/${tripId}/seats`, {
    headers: getAuthHeader(),
  });
  return res.data.data;
}

export async function holdSeatApi(req: SeatHoldRequest): Promise<SeatHoldResponse> {
  const res = await axios.post(`${API_URL}/api/v1/bookings/hold`, req, {
    headers: getAuthHeader(),
  });
  return res.data.data;
}

export async function releaseHoldApi(bookingId: string): Promise<{ success: boolean }> {
  const res = await axios.delete(`${API_URL}/api/v1/bookings/${bookingId}/hold`, {
    headers: getAuthHeader(),
  });
  return res.data.data;
}

export async function fetchMyBookings(): Promise<PassengerBookingsResponse> {
  const res = await axios.get(`${API_URL}/api/v1/bookings/my-bookings`, {
    headers: getAuthHeader(),
  });
  return res.data.data;
}

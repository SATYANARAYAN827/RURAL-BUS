import { apiClient } from './api.client.js';
import type {
  DriverDutyResponse,
  DriverDutyTrip,
  DriverHistoryResponse,
} from '@ruralbus/shared-types';

export async function fetchDriverDuty(): Promise<DriverDutyResponse> {
  const res = await apiClient.get<{ success: boolean; data: DriverDutyResponse }>(
    '/api/v1/driver/duty'
  );
  return res.data.data;
}

export async function startDriverTrip(tripId: string): Promise<DriverDutyTrip> {
  const res = await apiClient.post<{ success: boolean; data: { trip: DriverDutyTrip } }>(
    `/api/v1/driver/duty/${tripId}/start`
  );
  return res.data.data.trip;
}

export async function endDriverTrip(tripId: string): Promise<DriverDutyTrip> {
  const res = await apiClient.post<{ success: boolean; data: { trip: DriverDutyTrip } }>(
    `/api/v1/driver/duty/${tripId}/end`
  );
  return res.data.data.trip;
}

export async function fetchDriverHistory(): Promise<DriverHistoryResponse> {
  const res = await apiClient.get<{ success: boolean; data: DriverHistoryResponse }>(
    '/api/v1/driver/history'
  );
  return res.data.data;
}

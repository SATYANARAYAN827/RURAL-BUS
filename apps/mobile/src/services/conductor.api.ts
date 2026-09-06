import { apiClient } from './api.client.js';
import type {
  ConductorDutyResponse,
  ConductorManifestResponse,
  ConductorStatsResponse,
} from '@ruralbus/shared-types';

export async function fetchConductorDuty(): Promise<ConductorDutyResponse> {
  const res = await apiClient.get<{ success: boolean; data: ConductorDutyResponse }>(
    '/api/v1/conductor/duty'
  );
  return res.data.data;
}

export async function fetchPassengerManifest(tripId: string): Promise<ConductorManifestResponse> {
  const res = await apiClient.get<{ success: boolean; data: ConductorManifestResponse }>(
    `/api/v1/conductor/manifest/${tripId}`
  );
  return res.data.data;
}

export async function updatePassengerBoarding(
  tripId: string,
  ticketId: string,
  isBoarded: boolean
): Promise<{ success: boolean; ticketId: string; isBoarded: boolean }> {
  const res = await apiClient.put<{
    success: boolean;
    data: { success: boolean; ticketId: string; isBoarded: boolean };
  }>(`/api/v1/conductor/manifest/${tripId}/board/${ticketId}`, { isBoarded });
  return res.data.data;
}

export async function fetchConductorStats(): Promise<ConductorStatsResponse> {
  const res = await apiClient.get<{ success: boolean; data: ConductorStatsResponse }>(
    '/api/v1/conductor/stats'
  );
  return res.data.data;
}

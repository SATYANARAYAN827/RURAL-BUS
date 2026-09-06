import { apiClient } from './api.client.js';
import type {
  OperatorProfile,
  UpdateOperatorProfileInput,
} from '@ruralbus/shared-types';

export async function fetchOperatorProfile(): Promise<OperatorProfile> {
  const res = await apiClient.get<{ success: boolean; data: { profile: OperatorProfile } }>(
    '/api/v1/operator/profile'
  );
  return res.data.data.profile;
}

export async function updateOperatorProfile(
  input: UpdateOperatorProfileInput
): Promise<OperatorProfile> {
  const res = await apiClient.put<{ success: boolean; data: { profile: OperatorProfile } }>(
    '/api/v1/operator/profile',
    input
  );
  return res.data.data.profile;
}

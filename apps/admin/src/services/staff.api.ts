import { apiClient } from './api.client.js';
import type {
  StaffMember,
  StaffListResponse,
  CreateStaffInput,
} from '@ruralbus/shared-types';

export async function fetchStaffMembers(params?: {
  role?: 'DRIVER' | 'CONDUCTOR';
  search?: string;
}): Promise<StaffListResponse> {
  const res = await apiClient.get<{ success: boolean; data: StaffListResponse }>(
    '/api/v1/operator/staff',
    { params }
  );
  return res.data.data;
}

export async function createStaffMember(input: CreateStaffInput): Promise<StaffMember> {
  const res = await apiClient.post<{ success: boolean; data: { staff: StaffMember } }>(
    '/api/v1/operator/staff',
    input
  );
  return res.data.data.staff;
}

export async function updateStaffStatus(
  staffId: string,
  isActive: boolean
): Promise<StaffMember> {
  const res = await apiClient.put<{ success: boolean; data: { staff: StaffMember } }>(
    `/api/v1/operator/staff/${staffId}/status`,
    { isActive }
  );
  return res.data.data.staff;
}

export async function resetStaffPassword(
  staffId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; data: { success: boolean; message: string } }>(
    `/api/v1/operator/staff/${staffId}/reset-password`,
    { newPassword }
  );
  return res.data.data;
}

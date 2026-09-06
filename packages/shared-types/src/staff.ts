export type StaffRole = 'DRIVER' | 'CONDUCTOR';

export interface StaffMember {
  id: string; // operator_members.id
  userId: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: StaffRole;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffListResponse {
  staff: StaffMember[];
  total: number;
  activeDrivers: number;
  activeConductors: number;
}

export interface CreateStaffInput {
  fullName: string;
  phone: string;
  email?: string;
  role: StaffRole;
  password: string;
}

export interface UpdateStaffStatusInput {
  isActive: boolean;
}

export interface ResetStaffPasswordInput {
  newPassword: string;
}

export interface OperatorProfile {
  id: string;
  companyName: string;
  businessCode: string;
  contactEmail: string;
  contactPhone: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOperatorProfileInput {
  companyName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

import type { OperatorMemberRole } from './auth.js';

export type OperatorStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface Operator {
  id: string; // tenant_id
  companyName: string;
  businessCode: string;
  contactEmail: string;
  contactPhone: string;
  status: OperatorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorMember {
  id: string;
  userId: string;
  tenantId: string;
  role: OperatorMemberRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantContext {
  tenantId: string;
  operatorName?: string;
  role: OperatorMemberRole;
  userId: string;
}

export interface CreateOperatorInput {
  companyName: string;
  ownerName: string;
  phone: string;
  email?: string;
  password: string;
  businessCode?: string;
}

export interface OperatorProvisionResult {
  operator: {
    id: string;
    companyName: string;
    businessCode: string;
    contactEmail: string;
    contactPhone: string;
    status: OperatorStatus;
    createdAt: string;
  };
  owner: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    role: 'OPERATOR_ADMIN';
  };
  sms: {
    sent: boolean;
    provider: 'fast2sms' | 'twilio' | 'msg91' | 'mock' | 'none';
    maskedPhone: string;
    message: string;
    error?: string;
  };
}

export interface OperatorDetails extends Operator {
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  busesCount: number;
  staffCount: number;
}


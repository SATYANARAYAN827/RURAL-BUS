import type { AppUserRole } from '@ruralbus/shared-types';

export type RootStackParamList = {
  Auth: undefined;
  PassengerHome: undefined;
  DriverDashboard: undefined;
  ConductorScanner: undefined;
};

export interface AppAuthState {
  isAuthenticated: boolean;
  userRole: AppUserRole | null;
  userId: string | null;
  tenantId: string | null;
}

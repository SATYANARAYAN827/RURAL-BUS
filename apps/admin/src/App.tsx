import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/query.client.js';
import { useAdminAuthStore } from './stores/auth.store.js';
import { RoleGuard } from './components/guards/RoleGuard.js';
import { LoginView } from './views/LoginView.js';
import { PassengerApp } from './apps/PassengerApp.js';
import { DriverApp } from './apps/DriverApp.js';
import { ConductorApp } from './apps/ConductorApp.js';
import { OwnerDashboard } from './apps/OwnerDashboard.js';
import { SuperAdminDashboard } from './apps/SuperAdminDashboard.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

function RoleRouter() {
  const { user, initialize } = useAdminAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const renderAppForRole = () => {
    switch (user?.role) {
      case 'PASSENGER':
        return <PassengerApp />;
      case 'DRIVER':
        return <DriverApp />;
      case 'CONDUCTOR':
        return <ConductorApp />;
      case 'PLATFORM_ADMIN':
        return <SuperAdminDashboard />;
      case 'OPERATOR_ADMIN':
      default:
        return <OwnerDashboard />;
    }
  };

  return (
    <RoleGuard fallbackLogin={<LoginView />}>
      {renderAppForRole()}
    </RoleGuard>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RoleRouter />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}


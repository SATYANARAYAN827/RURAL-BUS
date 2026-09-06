import { useState } from 'react';
import { useAdminAuthStore } from '../../stores/auth.store.js';
import { Sidebar, AdminNavView } from './Sidebar.js';
import { Header } from './Header.js';
import { Breadcrumbs } from './Breadcrumbs.js';
import { OverviewView } from '../../views/OverviewView.js';
import { FleetRadarView } from '../../views/FleetRadarView.js';
import { PassengerSimulatorView } from '../../views/PassengerSimulatorView.js';
import { DriverSimulatorView } from '../../views/DriverSimulatorView.js';
import { ConductorSimulatorView } from '../../views/ConductorSimulatorView.js';
import { RoutesView } from '../../views/RoutesView.js';
import { SchedulesView } from '../../views/SchedulesView.js';
import { StaffView } from '../../views/StaffView.js';
import { SettingsView } from '../../views/SettingsView.js';
import { colors, spacing } from '@ruralbus/ui';

const VIEW_TITLES: Record<AdminNavView, string> = {
  OVERVIEW: 'Operations Overview',
  FLEET_RADAR: 'Live Fleet Radar (Telemetry Hub)',
  PASSENGER_APP: 'Passenger Mobile Experience (Search, Track & Book)',
  DRIVER_HUD: 'Driver Active Duty HUD & GPS Broadcaster',
  CONDUCTOR_SCANNER: 'Conductor Ticket Scanner & Thermal Cash POS',
  ROUTES: 'Route Network & Geo-Fenced Stops',
  SCHEDULES: 'Timetable Scheduling & Dispatch',
  STAFF: 'Driver & Conductor Staff Management',
  SETTINGS: 'Operator Company Profile & API Config',
};

function getDefaultViewForRole(role?: string): AdminNavView {
  switch (role) {
    case 'DRIVER':
      return 'DRIVER_HUD';
    case 'PASSENGER':
      return 'PASSENGER_APP';
    case 'CONDUCTOR':
      return 'CONDUCTOR_SCANNER';
    case 'OPERATOR_ADMIN':
    default:
      return 'OVERVIEW';
  }
}

export function MainLayout() {
  const { user } = useAdminAuthStore();
  const [activeView, setActiveView] = useState<AdminNavView>(getDefaultViewForRole(user?.role));

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: colors.background.primary,
        color: colors.text.primary,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Sidebar Navigation */}
      <Sidebar activeView={activeView} onSelectView={setActiveView} />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header activeViewTitle={VIEW_TITLES[activeView]} />

        <main
          style={{
            flex: 1,
            padding: spacing.xl,
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
        >
          <Breadcrumbs activeView={activeView} />

          {activeView === 'OVERVIEW' && <OverviewView />}
          {activeView === 'FLEET_RADAR' && <FleetRadarView />}
          {activeView === 'PASSENGER_APP' && <PassengerSimulatorView />}
          {activeView === 'DRIVER_HUD' && <DriverSimulatorView />}
          {activeView === 'CONDUCTOR_SCANNER' && <ConductorSimulatorView />}
          {activeView === 'ROUTES' && <RoutesView />}
          {activeView === 'SCHEDULES' && <SchedulesView />}
          {activeView === 'STAFF' && <StaffView />}
          {activeView === 'SETTINGS' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

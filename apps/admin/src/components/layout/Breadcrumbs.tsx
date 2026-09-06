import { colors, spacing } from '@ruralbus/ui';
import type { AdminNavView } from './Sidebar.js';

interface BreadcrumbsProps {
  activeView: AdminNavView;
}

const VIEW_NAMES: Record<AdminNavView, string> = {
  OVERVIEW: 'Operations Overview',
  FLEET_RADAR: 'Live Fleet Radar',
  PASSENGER_APP: 'Passenger Mobile App',
  DRIVER_HUD: 'Driver Duty HUD',
  CONDUCTOR_SCANNER: 'Conductor POS Scanner',
  ROUTES: 'Routes & Geo-Fenced Stops',
  SCHEDULES: 'Timetables & Dispatching',
  STAFF: 'Staff Provisioning (Drivers & Conductors)',
  SETTINGS: 'Operator Profile & Settings',
};

export function Breadcrumbs({ activeView }: BreadcrumbsProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.xs,
        fontSize: 12,
        color: colors.text.secondary,
        marginBottom: spacing.md,
      }}
    >
      <span>Dashboard</span>
      <span>›</span>
      <span style={{ color: colors.brand.primary, fontWeight: 600 }}>
        {VIEW_NAMES[activeView] || activeView}
      </span>
    </div>
  );
}

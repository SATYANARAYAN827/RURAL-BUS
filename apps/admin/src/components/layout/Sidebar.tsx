import { colors, spacing, borderRadius } from '@ruralbus/ui';

export type AdminNavView =
  | 'OVERVIEW'
  | 'FLEET_RADAR'
  | 'PASSENGER_APP'
  | 'DRIVER_HUD'
  | 'CONDUCTOR_SCANNER'
  | 'ROUTES'
  | 'SCHEDULES'
  | 'STAFF'
  | 'SETTINGS';

interface SidebarProps {
  activeView: AdminNavView;
  onSelectView: (view: AdminNavView) => void;
}

interface NavItem {
  id: AdminNavView;
  label: string;
  icon: string;
  badge?: string;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Operations & Telemetry
  { id: 'OVERVIEW', label: 'Operations Overview', icon: '📊', group: 'OPERATIONS' },
  { id: 'FLEET_RADAR', label: 'Live Fleet Radar', icon: '🛰️', badge: 'Live', group: 'OPERATIONS' },

  // Role Simulators
  { id: 'PASSENGER_APP', label: 'Passenger App (User)', icon: '🧑', badge: 'User Mode', group: 'LIVE ROLE EXPERIENCES' },
  { id: 'DRIVER_HUD', label: 'Driver Duty HUD', icon: '🚌', badge: 'Driver', group: 'LIVE ROLE EXPERIENCES' },
  { id: 'CONDUCTOR_SCANNER', label: 'Conductor POS Scanner', icon: '🎫', badge: 'Conductor', group: 'LIVE ROLE EXPERIENCES' },

  // Transit Management
  { id: 'ROUTES', label: 'Routes & Stops', icon: '🗺️', group: 'FLEET & DISPATCH' },
  { id: 'SCHEDULES', label: 'Timetables & Dispatch', icon: '⏱️', group: 'FLEET & DISPATCH' },
  { id: 'STAFF', label: 'Staff Management', icon: '👥', group: 'FLEET & DISPATCH' },
  { id: 'SETTINGS', label: 'Depot & API Settings', icon: '⚙️', group: 'SYSTEM' },
];

export function Sidebar({ activeView, onSelectView }: SidebarProps) {
  let lastGroup = '';

  return (
    <aside
      style={{
        width: 270,
        backgroundColor: '#ffffff',
        borderRight: `1.5px solid ${colors.border.subtle}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        boxSizing: 'border-box',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '20px 18px',
          borderBottom: `1.5px solid ${colors.border.subtle}`,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <span style={{ fontSize: 28 }}>🚌</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#14291c' }}>RURAL</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#16a34a' }}>BUS</span>
          </div>
          <div style={{ fontSize: 11, color: colors.text.secondary, fontWeight: 600 }}>
            Rural Transport Hub
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav
        style={{
          padding: spacing.md,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          overflowY: 'auto',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          const showGroup = item.group && item.group !== lastGroup;
          if (showGroup) lastGroup = item.group!;

          return (
            <div key={item.id}>
              {showGroup && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: colors.text.tertiary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginTop: 14,
                    marginBottom: 4,
                    paddingLeft: 8,
                  }}
                >
                  {item.group}
                </div>
              )}
              <button
                onClick={() => onSelectView(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: borderRadius.md,
                  backgroundColor: isActive ? '#f0fdf4' : 'transparent',
                  border: isActive ? `1.5px solid #86efac` : '1.5px solid transparent',
                  color: isActive ? '#15803d' : colors.text.primary,
                  fontWeight: isActive ? 800 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    style={{
                      padding: '2px 6px',
                      backgroundColor:
                        item.id === 'PASSENGER_APP'
                          ? '#dbeafe'
                          : item.id === 'DRIVER_HUD'
                          ? '#fef3c7'
                          : item.id === 'CONDUCTOR_SCANNER'
                          ? '#f3e8ff'
                          : '#dcfce7',
                      color:
                        item.id === 'PASSENGER_APP'
                          ? '#1d4ed8'
                          : item.id === 'DRIVER_HUD'
                          ? '#b45309'
                          : item.id === 'CONDUCTOR_SCANNER'
                          ? '#7e22ce'
                          : '#15803d',
                      borderRadius: borderRadius.sm,
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer info */}
      <div
        style={{
          padding: spacing.md,
          borderTop: `1.5px solid ${colors.border.subtle}`,
          fontSize: 11,
          color: colors.text.secondary,
          textAlign: 'center',
          backgroundColor: '#f8faf9',
          fontWeight: 600,
        }}
      >
        Rural Public Transit Engine · 4G GPS
      </div>
    </aside>
  );
}

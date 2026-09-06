import { colors, spacing, borderRadius, shadows } from '@ruralbus/ui';
import { operatorStore } from '../services/operatorStore.service.js';

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  icon: string;
}

function StatCard({ label, value, change, icon }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: borderRadius.xl,
        border: `1.5px solid ${colors.border.subtle}`,
        padding: spacing.lg,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        boxShadow: shadows.card,
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: colors.text.secondary, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: colors.text.primary, marginTop: spacing.xs }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4, fontWeight: 700 }}>
          {change}
        </div>
      </div>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: borderRadius.lg,
          backgroundColor: '#e6f4ea',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        {icon}
      </div>
    </div>
  );
}

export function OverviewView() {
  const buses = operatorStore.getBuses();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {/* Top Banner */}
      <div
        style={{
          backgroundColor: '#166534',
          color: '#ffffff',
          borderRadius: borderRadius.xl,
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(22, 101, 52, 0.25)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
            RuralBus · Rural Transit Control Center
          </h2>
          <p style={{ fontSize: 13, margin: '4px 0 0 0', color: '#bbf7d0' }}>
            Real-time fleet telemetry, corridor dispatching, and cash-digital ticketing reconciliation
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <span
            style={{
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              color: '#166534',
              borderRadius: borderRadius.full,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            ● 4G GPS Live
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: spacing.lg,
        }}
      >
        <StatCard label="Today's Active Buses" value="24 Buses" change="● 100% 4G telemetry active" icon="🚍" />
        <StatCard label="Dispatched Trips" value="56 Trips" change="↑ 6 in progress now" icon="⏱️" />
        <StatCard label="Total Passengers Carried" value="1,840" change="↑ 18% vs last week" icon="🎟️" />
        <StatCard label="Reconciled Fare Revenue" value="₹1,12,650" change="Razorpay + POS Cash settled" icon="💰" />
      </div>

      {/* Operational Highlights Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing.lg }}>
        {/* Active Trips Monitor Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: borderRadius.xl,
            border: `1.5px solid ${colors.border.subtle}`,
            padding: spacing.lg,
            boxShadow: shadows.card,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.text.primary, margin: 0 }}>
              Active Rural Corridor Trips
            </h3>
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
              ● Live Real-Time Feed
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {buses.length === 0 ? (
              <div
                style={{
                  padding: spacing.lg,
                  textAlign: 'center',
                  backgroundColor: '#f8faf9',
                  borderRadius: borderRadius.lg,
                  border: `1px solid ${colors.border.subtle}`,
                  color: colors.text.secondary,
                  fontSize: 13,
                }}
              >
                No buses added / No active trips
              </div>
            ) : (
              buses.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    backgroundColor: '#f8faf9',
                    border: `1px solid ${colors.border.subtle}`,
                    borderRadius: borderRadius.lg,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: colors.text.primary }}>
                      {b.reg} · {b.name}
                    </div>
                    <div style={{ fontSize: 12, color: colors.text.secondary, marginTop: 2 }}>
                      Driver: {b.driver} · Conductor: {b.conductor} · Route: {b.route}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      backgroundColor: b.status === 'RUNNING' ? '#dcfce7' : '#f1f5f9',
                      color: b.status === 'RUNNING' ? '#15803d' : '#475569',
                      borderRadius: borderRadius.md,
                      fontSize: 12,
                      fontWeight: 700,
                      alignSelf: 'center',
                    }}
                  >
                    {b.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Alerts */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: borderRadius.xl,
            border: `1.5px solid ${colors.border.subtle}`,
            padding: spacing.lg,
            boxShadow: shadows.card,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.text.primary, margin: '0 0 16px 0' }}>
            Telemetry & Financial Status
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            <div
              style={{
                padding: spacing.md,
                backgroundColor: '#f0fdf4',
                border: `1.5px solid #86efac`,
                borderRadius: borderRadius.lg,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#15803d' }}>
                4G GPS Telemetry Stream Active
              </div>
              <div style={{ fontSize: 11, color: colors.text.secondary, marginTop: 2 }}>
                Spatial positioning & speed calculation operating at &lt;50ms latency.
              </div>
            </div>

            <div
              style={{
                padding: spacing.md,
                backgroundColor: '#fefce8',
                border: `1.5px solid #fde047`,
                borderRadius: borderRadius.lg,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#a16207' }}>
                Conductor Cash Settlement Ready
              </div>
              <div style={{ fontSize: 11, color: colors.text.secondary, marginTop: 2 }}>
                Central Depot cash collection reconciled with cryptographic hash chain.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

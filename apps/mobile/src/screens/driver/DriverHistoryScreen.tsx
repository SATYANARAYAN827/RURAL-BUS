import { useState, useEffect } from 'react';
import { fetchDriverHistory } from '../../services/driver.api.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { DriverHistoryTrip } from '@ruralbus/shared-types';

export function DriverHistoryScreen() {
  const [trips, setTrips] = useState<DriverHistoryTrip[]>([]);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [totalDistanceDrivenKm, setTotalDistanceDrivenKm] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        setIsLoading(true);
        const data = await fetchDriverHistory();
        setTrips(data.trips);
        setTotalCompleted(data.totalCompleted);
        setTotalDistanceDrivenKm(data.totalDistanceDrivenKm);
      } catch (err: any) {
        setErrorMessage(err.response?.data?.error?.message || err.message || 'Failed to load history');
      } finally {
        setIsLoading(false);
      }
    }
    loadHistory();
  }, []);

  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 16px 0' }}>Driver Shift History</h1>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md, marginBottom: spacing.lg }}>
        <div style={{ padding: spacing.md, backgroundColor: colors.background.secondary, borderRadius: borderRadius.md, border: `1px solid ${colors.border.subtle}` }}>
          <div style={{ fontSize: 12, color: colors.text.secondary }}>Completed Trips</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: colors.brand.primary, marginTop: 4 }}>{totalCompleted}</div>
        </div>
        <div style={{ padding: spacing.md, backgroundColor: colors.background.secondary, borderRadius: borderRadius.md, border: `1px solid ${colors.border.subtle}` }}>
          <div style={{ fontSize: 12, color: colors.text.secondary }}>Distance Driven</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: colors.status.warning, marginTop: 4 }}>{totalDistanceDrivenKm} km</div>
        </div>
      </div>

      {errorMessage && (
        <div style={{ padding: spacing.md, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${colors.status.error}`, borderRadius: borderRadius.md, color: colors.status.error, fontSize: 13, marginBottom: spacing.lg }}>
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.text.secondary }}>Loading history...</div>
      ) : trips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.text.secondary, backgroundColor: colors.background.secondary, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}` }}>
          No completed trips found in your log yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {trips.map((t) => (
            <div
              key={t.id}
              style={{
                backgroundColor: colors.background.secondary,
                borderRadius: borderRadius.lg,
                border: `1px solid ${colors.border.subtle}`,
                padding: spacing.md,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: colors.status.warning, fontFamily: 'monospace' }}>
                  {t.routeCode}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: borderRadius.sm, backgroundColor: 'rgba(34, 197, 94, 0.15)', color: colors.brand.primary, fontWeight: 600 }}>
                  COMPLETED
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 'bold', marginTop: 4 }}>{t.origin} ➔ {t.destination}</div>
              <div style={{ fontSize: 12, color: colors.text.secondary, marginTop: 4 }}>
                Bus: {t.busRegistrationNumber} • {t.totalDistanceKm} km • Arr: {t.actualArrival ? new Date(t.actualArrival).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

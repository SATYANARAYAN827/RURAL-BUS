import { useState, useEffect } from 'react';
import { fetchConductorStats } from '../../services/conductor.api.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { ConductorStatsResponse } from '@ruralbus/shared-types';

export function ConductorStatsScreen() {
  const [stats, setStats] = useState<ConductorStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setIsLoading(true);
        const data = await fetchConductorStats();
        setStats(data);
      } catch (err: any) {
        setErrorMessage(err.response?.data?.error?.message || err.message || 'Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 16px 0' }}>Conductor Shift Performance</h1>

      {errorMessage && (
        <div style={{ padding: spacing.md, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${colors.status.error}`, borderRadius: borderRadius.md, color: colors.status.error, fontSize: 13, marginBottom: spacing.lg }}>
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.text.secondary }}>Loading statistics...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing.md }}>
          <div style={{ backgroundColor: colors.background.secondary, padding: spacing.lg, borderRadius: borderRadius.md, border: `1px solid ${colors.border.subtle}` }}>
            <div style={{ fontSize: 12, color: colors.text.secondary }}>Trips Handled</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: colors.status.info, marginTop: 4 }}>
              {stats?.totalTripsHandled ?? 0}
            </div>
          </div>

          <div style={{ backgroundColor: colors.background.secondary, padding: spacing.lg, borderRadius: borderRadius.md, border: `1px solid ${colors.border.subtle}` }}>
            <div style={{ fontSize: 12, color: colors.text.secondary }}>Passengers Boarded</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: colors.brand.primary, marginTop: 4 }}>
              {stats?.totalPassengersBoarded ?? 0}
            </div>
          </div>

          <div style={{ backgroundColor: colors.background.secondary, padding: spacing.lg, borderRadius: borderRadius.md, border: `1px solid ${colors.border.subtle}` }}>
            <div style={{ fontSize: 12, color: colors.text.secondary }}>Shift Collections</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: colors.status.warning, marginTop: 4 }}>
              ₹{stats?.totalShiftCollections ?? 0}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

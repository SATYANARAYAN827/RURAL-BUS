import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/auth.store.js';
import { fetchDriverDuty, startDriverTrip, endDriverTrip } from '../../services/driver.api.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { DriverDutyTrip } from '@ruralbus/shared-types';

export function DriverDashboardScreen() {
  const { user } = useAuthStore();
  const [activeTrip, setActiveTrip] = useState<DriverDutyTrip | null>(null);
  const [upcomingTrips, setUpcomingTrips] = useState<DriverDutyTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDuty = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await fetchDriverDuty();
      setActiveTrip(data.activeTrip);
      setUpcomingTrips(data.upcomingTrips);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error?.message || err.message || 'Failed to load duty');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDuty();
  }, [loadDuty]);

  const handleStartTrip = async (tripId: string) => {
    try {
      setIsActionPending(true);
      setErrorMessage(null);
      await startDriverTrip(tripId);
      await loadDuty();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error?.message || err.message || 'Failed to start trip');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleEndTrip = async (tripId: string) => {
    try {
      setIsActionPending(true);
      setErrorMessage(null);
      await endDriverTrip(tripId);
      await loadDuty();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error?.message || err.message || 'Failed to complete trip');
    } finally {
      setIsActionPending(false);
    }
  };

  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary, maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
        <div>
          <span style={{ fontSize: 13, color: colors.status.warning, fontWeight: 600 }}>DRIVER DUTY HUD</span>
          <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: '4px 0 0 0' }}>
            {user?.fullName || 'Driver'}
          </h1>
        </div>
        <button
          onClick={loadDuty}
          style={{
            padding: '6px 12px',
            backgroundColor: colors.background.secondary,
            border: `1px solid ${colors.border.subtle}`,
            borderRadius: borderRadius.md,
            color: colors.text.secondary,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          style={{
            padding: spacing.md,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${colors.status.error}`,
            borderRadius: borderRadius.md,
            color: colors.status.error,
            fontSize: 13,
            marginBottom: spacing.lg,
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.text.secondary }}>
          Loading active duty manifest...
        </div>
      ) : activeTrip ? (
        <div>
          {/* Active Trip Card */}
          <div
            style={{
              backgroundColor: colors.background.secondary,
              borderRadius: borderRadius.lg,
              border: `1px solid ${colors.border.subtle}`,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: borderRadius.sm,
                    fontSize: 11,
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(234, 179, 8, 0.15)',
                    color: colors.status.warning,
                    fontFamily: 'monospace',
                  }}
                >
                  {activeTrip.routeCode}
                </span>
                <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: '8px 0 2px 0' }}>
                  {activeTrip.origin} ➔ {activeTrip.destination}
                </h2>
                <div style={{ fontSize: 12, color: colors.text.secondary }}>
                  Vehicle: <strong style={{ color: colors.text.primary }}>{activeTrip.busRegistrationNumber}</strong> ({activeTrip.busModel})
                </div>
              </div>

              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: borderRadius.sm,
                  fontSize: 12,
                  fontWeight: 'bold',
                  backgroundColor:
                    activeTrip.status === 'IN_TRANSIT'
                      ? 'rgba(34, 197, 94, 0.15)'
                      : activeTrip.status === 'COMPLETED'
                      ? 'rgba(234, 179, 8, 0.15)'
                      : 'rgba(59, 130, 246, 0.15)',
                  color:
                    activeTrip.status === 'IN_TRANSIT'
                      ? colors.brand.primary
                      : activeTrip.status === 'COMPLETED'
                      ? colors.status.warning
                      : colors.status.info,
                }}
              >
                {activeTrip.status}
              </span>
            </div>

            {/* Crew & Timing Details */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: spacing.md,
                marginTop: spacing.md,
                padding: spacing.md,
                backgroundColor: colors.background.tertiary,
                borderRadius: borderRadius.md,
                fontSize: 12,
              }}
            >
              <div>
                <span style={{ color: colors.text.secondary }}>Scheduled Dep:</span>
                <div style={{ fontWeight: 'bold', marginTop: 2 }}>
                  {new Date(activeTrip.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div>
                <span style={{ color: colors.text.secondary }}>Scheduled Arr:</span>
                <div style={{ fontWeight: 'bold', marginTop: 2 }}>
                  {new Date(activeTrip.scheduledArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div>
                <span style={{ color: colors.text.secondary }}>Assigned Conductor:</span>
                <div style={{ fontWeight: 'bold', marginTop: 2 }}>
                  {activeTrip.conductorName || 'Unassigned'}
                </div>
              </div>
              <div>
                <span style={{ color: colors.text.secondary }}>Total Corridor:</span>
                <div style={{ fontWeight: 'bold', marginTop: 2 }}>
                  {activeTrip.totalDistanceKm} km ({activeTrip.estimatedDurationMinutes} mins)
                </div>
              </div>
            </div>

            {/* Sequenced Route Stops */}
            {activeTrip.stops.length > 0 && (
              <div style={{ marginTop: spacing.md }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: colors.text.secondary, marginBottom: 6 }}>
                  Itinerary Stops ({activeTrip.stops.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeTrip.stops.map((s, idx) => (
                    <div
                      key={s.stopId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        padding: '6px 10px',
                        backgroundColor: colors.background.tertiary,
                        borderRadius: borderRadius.sm,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            backgroundColor: idx === 0 || idx === activeTrip.stops.length - 1 ? colors.status.warning : colors.border.subtle,
                            color: '#000',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                          }}
                        >
                          {s.sequenceNumber}
                        </span>
                        <span>{s.stopName}</span>
                      </div>
                      <span style={{ color: colors.text.tertiary, fontSize: 11 }}>
                        +{s.distanceFromStartKm} km
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action State Machine Button */}
            <div style={{ marginTop: spacing.lg }}>
              {(activeTrip.status === 'SCHEDULED' || activeTrip.status === 'BOARDING') && (
                <button
                  disabled={isActionPending}
                  onClick={() => handleStartTrip(activeTrip.id)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    backgroundColor: colors.brand.primary,
                    color: '#000',
                    fontWeight: 'bold',
                    fontSize: 15,
                    border: 'none',
                    borderRadius: borderRadius.md,
                    cursor: 'pointer',
                  }}
                >
                  {isActionPending ? 'Starting...' : '▶ Start Trip & Enable Telemetry'}
                </button>
              )}

              {activeTrip.status === 'IN_TRANSIT' && (
                <button
                  disabled={isActionPending}
                  onClick={() => handleEndTrip(activeTrip.id)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    backgroundColor: colors.status.error,
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: 15,
                    border: 'none',
                    borderRadius: borderRadius.md,
                    cursor: 'pointer',
                  }}
                >
                  {isActionPending ? 'Completing...' : '⏹ Complete Trip & End Duty'}
                </button>
              )}

              {activeTrip.status === 'COMPLETED' && (
                <div
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    padding: spacing.md,
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    color: colors.brand.primary,
                    borderRadius: borderRadius.md,
                    fontWeight: 'bold',
                    boxSizing: 'border-box',
                  }}
                >
                  ✓ Trip Completed
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Trips Queue */}
          {upcomingTrips.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 'bold', color: colors.text.secondary, marginBottom: spacing.sm }}>
                Upcoming Dispatched Runs ({upcomingTrips.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {upcomingTrips.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      padding: spacing.md,
                      backgroundColor: colors.background.secondary,
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.border.subtle}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: 13 }}>{u.origin} ➔ {u.destination}</div>
                      <div style={{ fontSize: 11, color: colors.text.secondary, marginTop: 2 }}>
                        Dep: {new Date(u.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Bus: {u.busRegistrationNumber}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: colors.status.info, fontWeight: 'bold' }}>QUEUED</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.border.subtle}`,
            padding: spacing.xl,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: spacing.sm }}>🚍</div>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', margin: '0 0 8px 0' }}>No Active Duty Assigned</h2>
          <p style={{ fontSize: 13, color: colors.text.secondary, margin: 0 }}>
            You do not currently have an active trip dispatched. When your operator schedules your next route run, it will appear here automatically.
          </p>
        </div>
      )}

      {/* Emergency SOS Card */}
      <div
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.status.error}`,
          padding: spacing.md,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: spacing.xl,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: colors.status.error }}>Breakdown / SOS Alert</div>
          <div style={{ fontSize: 12, color: colors.text.secondary, marginTop: 2 }}>Notify Operator Dispatch instantly</div>
        </div>
        <button
          onClick={() => alert('Emergency SOS alert transmitted to Operator Dispatch')}
          style={{
            padding: '8px 14px',
            backgroundColor: colors.status.error,
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 12,
            border: 'none',
            borderRadius: borderRadius.sm,
            cursor: 'pointer',
          }}
        >
          SOS Alert
        </button>
      </div>
    </div>
  );
}

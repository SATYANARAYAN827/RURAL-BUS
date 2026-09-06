import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/auth.store.js';
import {
  fetchConductorDuty,
  fetchPassengerManifest,
  updatePassengerBoarding,
} from '../../services/conductor.api.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type {
  ConductorDutyResponse,
  ConductorManifestResponse,
  ManifestPassengerEntry,
} from '@ruralbus/shared-types';

export function ConductorDashboardScreen() {
  const { user } = useAuthStore();
  const [duty, setDuty] = useState<ConductorDutyResponse | null>(null);
  const [manifest, setManifest] = useState<ConductorManifestResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionTicketId, setActionTicketId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const dutyData = await fetchConductorDuty();
      setDuty(dutyData);

      if (dutyData.activeTrip) {
        const manifestData = await fetchPassengerManifest(dutyData.activeTrip.id);
        setManifest(manifestData);
      } else {
        setManifest(null);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error?.message || err.message || 'Failed to load conductor duty');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleBoarding = async (ticket: ManifestPassengerEntry) => {
    if (!duty?.activeTrip) return;
    try {
      setActionTicketId(ticket.ticketId);
      await updatePassengerBoarding(duty.activeTrip.id, ticket.ticketId, !ticket.isBoarded);
      // Reload manifest
      const updatedManifest = await fetchPassengerManifest(duty.activeTrip.id);
      setManifest(updatedManifest);
      // Also update duty occupancy counters
      const updatedDuty = await fetchConductorDuty();
      setDuty(updatedDuty);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update boarding status');
    } finally {
      setActionTicketId(null);
    }
  };

  const filteredPassengers = manifest?.passengers.filter(
    (p) =>
      p.passengerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.seatNumber.includes(searchTerm) ||
      p.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary, maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
        <div>
          <span style={{ fontSize: 13, color: colors.status.info, fontWeight: 600 }}>CONDUCTOR MANIFEST</span>
          <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: '4px 0 0 0' }}>
            {user?.fullName || 'Conductor'}
          </h1>
        </div>
        <button
          onClick={loadData}
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

      {errorMessage && (
        <div style={{ padding: spacing.md, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${colors.status.error}`, borderRadius: borderRadius.md, color: colors.status.error, fontSize: 13, marginBottom: spacing.lg }}>
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.text.secondary }}>
          Loading manifest...
        </div>
      ) : duty?.activeTrip ? (
        <div>
          {/* Active Trip & Occupancy Card */}
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
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: colors.status.info,
                    fontFamily: 'monospace',
                  }}
                >
                  {duty.activeTrip.routeCode}
                </span>
                <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: '8px 0 2px 0' }}>
                  {duty.activeTrip.origin} ➔ {duty.activeTrip.destination}
                </h2>
                <div style={{ fontSize: 12, color: colors.text.secondary }}>
                  Bus: <strong style={{ color: colors.text.primary }}>{duty.activeTrip.busRegistrationNumber}</strong>
                </div>
              </div>

              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: borderRadius.sm,
                  fontSize: 12,
                  fontWeight: 'bold',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: colors.status.info,
                }}
              >
                {duty.activeTrip.status}
              </span>
            </div>

            {/* Occupancy Stats Counter */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: spacing.sm,
                marginTop: spacing.md,
              }}
            >
              <div style={{ padding: spacing.sm, backgroundColor: colors.background.tertiary, borderRadius: borderRadius.md, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: colors.text.secondary }}>Total Booked</div>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginTop: 2 }}>
                  {duty.totalBookedSeats} / {duty.totalSeats}
                </div>
              </div>
              <div style={{ padding: spacing.sm, backgroundColor: colors.background.tertiary, borderRadius: borderRadius.md, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: colors.text.secondary }}>Boarded</div>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: colors.brand.primary, marginTop: 2 }}>
                  {duty.totalBoardedSeats}
                </div>
              </div>
              <div style={{ padding: spacing.sm, backgroundColor: colors.background.tertiary, borderRadius: borderRadius.md, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: colors.text.secondary }}>Awaiting</div>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: colors.status.warning, marginTop: 2 }}>
                  {duty.totalAwaitingSeats}
                </div>
              </div>
            </div>
          </div>

          {/* Passenger Search Bar */}
          <div style={{ marginBottom: spacing.md }}>
            <input
              type="text"
              placeholder="Search by passenger name or seat number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: colors.background.secondary,
                border: `1px solid ${colors.border.subtle}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Manifest Passenger List */}
          <div style={{ backgroundColor: colors.background.secondary, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}`, padding: spacing.md }}>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: spacing.sm }}>
              Passenger Check-In Manifest ({filteredPassengers?.length ?? 0})
            </div>

            {filteredPassengers && filteredPassengers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: spacing.lg, color: colors.text.secondary, fontSize: 13 }}>
                No passenger bookings found matching search.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {filteredPassengers?.map((p) => (
                  <div
                    key={p.ticketId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: p.isBoarded ? 'rgba(34, 197, 94, 0.08)' : colors.background.tertiary,
                      borderRadius: borderRadius.md,
                      border: `1px solid ${p.isBoarded ? 'rgba(34, 197, 94, 0.2)' : colors.border.subtle}`,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            backgroundColor: colors.status.info,
                            color: '#fff',
                            borderRadius: borderRadius.sm,
                            fontSize: 11,
                            fontWeight: 'bold',
                          }}
                        >
                          Seat #{p.seatNumber}
                        </span>
                        <span style={{ fontWeight: 'bold', fontSize: 14 }}>{p.passengerName}</span>
                      </div>
                      <div style={{ fontSize: 11, color: colors.text.secondary, marginTop: 4 }}>
                        {p.fromStopName} ➔ {p.toStopName} • {p.passengerPhone}
                      </div>
                    </div>

                    <button
                      disabled={actionTicketId === p.ticketId}
                      onClick={() => handleToggleBoarding(p)}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: p.isBoarded ? colors.background.secondary : colors.brand.primary,
                        color: p.isBoarded ? colors.brand.primary : '#000',
                        border: `1px solid ${colors.brand.primary}`,
                        borderRadius: borderRadius.md,
                        fontSize: 12,
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      {actionTicketId === p.ticketId
                        ? 'Updating...'
                        : p.isBoarded
                        ? '✓ Boarded'
                        : 'Mark Boarded'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          <div style={{ fontSize: 36, marginBottom: spacing.sm }}>📝</div>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', margin: '0 0 8px 0' }}>No Active Trip Manifest</h2>
          <p style={{ fontSize: 13, color: colors.text.secondary, margin: 0 }}>
            You are not currently assigned to an active trip run. When your operator dispatches your next service, passenger manifests will load here.
          </p>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { fetchMyBookings } from '../../services/booking.api.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { PassengerBookingSummary } from '@ruralbus/shared-types';

export function MyTicketsScreen() {
  const [bookings, setBookings] = useState<PassengerBookingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyBookings()
      .then((res) => {
        setBookings(res.bookings);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>My Bookings & Tickets</h1>
          <p style={{ fontSize: 12, color: colors.text.secondary, margin: '4px 0 0 0' }}>
            Confirmed passes & active seat reservations
          </p>
        </div>
        <span style={{ fontSize: 12, color: colors.brand.primary, fontWeight: 'bold' }}>
          {bookings.length} Total
        </span>
      </div>

      {loading && (
        <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>
          Loading your tickets & reservations...
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <div
          style={{
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.border.subtle}`,
            padding: spacing.xl,
            textAlign: 'center',
            color: colors.text.tertiary,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: spacing.xs }}>🎫</div>
          <div style={{ fontSize: 15, fontWeight: '600' }}>No Active Bookings Found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Search for bus routes to reserve seats and get tickets.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        {bookings.map((b) => {
          const isConfirmed = b.status === 'CONFIRMED' || b.status === 'BOARDED';
          const isHeld = b.status === 'HELD';

          return (
            <div
              key={b.id}
              style={{
                backgroundColor: colors.background.secondary,
                borderRadius: borderRadius.lg,
                border: `1px solid ${isHeld ? '#3b82f6' : isConfirmed ? '#10b981' : colors.border.subtle}`,
                padding: spacing.lg,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: `1px dashed ${colors.border.subtle}`,
                  paddingBottom: spacing.sm,
                  marginBottom: spacing.md,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isConfirmed ? '#34d399' : isHeld ? '#60a5fa' : colors.text.tertiary,
                      backgroundColor: isConfirmed ? 'rgba(16, 185, 129, 0.15)' : isHeld ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {b.status}
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>
                    {b.origin} ➔ {b.destination}
                  </div>
                  <div style={{ fontSize: 12, color: colors.text.secondary, marginTop: 2 }}>
                    {b.operatorName} · Route {b.routeCode}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: colors.text.secondary }}>Seat Number</div>
                  <div style={{ fontSize: 22, fontWeight: 'bold', color: colors.brand.primary }}>
                    #{b.seatNumber}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: colors.text.primary, marginTop: 2 }}>
                    ₹{b.fareAmount}
                  </div>
                </div>
              </div>

              {isConfirmed && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
                  <div style={{ fontSize: 12, color: colors.text.secondary }}>
                    🕒 Departs: {new Date(b.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div
                    style={{
                      padding: '4px 10px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      borderRadius: borderRadius.sm,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      fontWeight: 'bold',
                    }}
                  >
                    QR: {b.qrSignature ? b.qrSignature.slice(0, 10) : 'VERIFIED'}
                  </div>
                </div>
              )}

              {isHeld && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
                  <div style={{ fontSize: 12, color: '#93c5fd' }}>
                    🔒 Seat held for 5 minutes
                  </div>
                  <button
                    style={{
                      padding: '6px 14px',
                      backgroundColor: colors.brand.primary,
                      border: 'none',
                      borderRadius: borderRadius.sm,
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    Pay & Confirm ₹{b.fareAmount}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

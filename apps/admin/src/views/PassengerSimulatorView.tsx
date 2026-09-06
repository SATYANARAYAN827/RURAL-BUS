import React, { useState, useEffect } from 'react';
import { colors, spacing, borderRadius, shadows } from '@ruralbus/ui';

export function PassengerSimulatorView() {
  const [activeTab, setActiveTab] = useState<'BUSES' | 'PAY' | 'FEEDBACK' | 'EXIT'>('BUSES');
  const [origin, setOrigin] = useState('Stop A');
  const [destination, setDestination] = useState('Stop B');
  const [selectedBus, setSelectedBus] = useState<string | null>('BUS-4521');
  const [selectedSeat, setSelectedSeat] = useState<number | null>(14);
  const [lockedSeats, setLockedSeats] = useState<number[]>([3, 7, 12, 22, 28, 35]);
  const [holdTimer, setHoldTimer] = useState(300); // 5 minutes ACID hold
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [isBusOnline] = useState(true);

  // Seat hold timer
  useEffect(() => {
    if (selectedSeat && !bookingConfirmed && holdTimer > 0) {
      const interval = setInterval(() => setHoldTimer((prev) => Math.max(0, prev - 1)), 1000);
      return () => clearInterval(interval);
    }
  }, [selectedSeat, bookingConfirmed, holdTimer]);

  const handleSeatClick = (seatNum: number) => {
    if (lockedSeats.includes(seatNum) || bookingConfirmed) return;
    setSelectedSeat(seatNum === selectedSeat ? null : seatNum);
    setHoldTimer(300);
  };

  const handleConfirmBooking = () => {
    if (!selectedSeat) return;
    setBookingConfirmed(true);
    setLockedSeats([...lockedSeats, selectedSeat]);
    setActiveTab('PAY');
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.lg,
        padding: spacing.md,
      }}
    >
      {/* Mobile Frame Container - Clean RuralBus Passenger UI */}
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#ffffff',
          borderRadius: borderRadius.xl,
          border: `1px solid ${colors.border.subtle}`,
          boxShadow: shadows.elevated,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 680,
        }}
      >
        {/* Top Header Card with Passenger Name - Matches Screenshot 3 */}
        <div
          style={{
            padding: '24px 20px 16px 20px',
            backgroundColor: '#ffffff',
            borderBottom: `1px solid ${colors.border.subtle}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: colors.text.secondary, fontWeight: 500 }}>Welcome</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: colors.text.primary, margin: '2px 0 0 0' }}>
                Priya Das
              </h2>
            </div>

            {/* Circular Avatar 'P' */}
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: borderRadius.full,
                backgroundColor: '#e6f4ea',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 18,
                border: '1.5px solid #cce8d4',
              }}
            >
              P
            </div>
          </div>
        </div>

        {/* Content Body based on tab */}
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeTab === 'BUSES' && (
            <>
              {/* "Where are you going?" Search Card - Matches Screenshot 3 */}
              <div
                style={{
                  backgroundColor: '#f8faf9',
                  border: `1.5px solid ${colors.border.subtle}`,
                  borderRadius: borderRadius.lg,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: colors.text.primary }}>
                  Where are you going?
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: colors.text.secondary, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      From
                    </label>
                    <select
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#ffffff',
                        border: `1.5px solid ${colors.border.subtle}`,
                        borderRadius: borderRadius.md,
                        fontSize: 13,
                        color: colors.text.primary,
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    >
                      <option>Stop A</option>
                      <option>Stop B</option>
                      <option>Stop C</option>
                      <option>Stop D</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: colors.text.secondary, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      To
                    </label>
                    <select
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#ffffff',
                        border: `1.5px solid ${colors.border.subtle}`,
                        borderRadius: borderRadius.md,
                        fontSize: 13,
                        color: colors.text.primary,
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    >
                      <option>Stop B</option>
                      <option>Stop C</option>
                      <option>Stop D</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Buses Section Header - Matches Screenshot 3 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: colors.text.primary }}>
                    Live buses
                  </span>
                  <span style={{ fontSize: 12, color: colors.text.secondary, fontWeight: 500 }}>
                    1 found
                  </span>
                </div>

                {/* Bus Card Item - Matches Screenshot 3 */}
                <div
                  onClick={() => setSelectedBus('BUS-4521')}
                  style={{
                    backgroundColor: '#ffffff',
                    border: `1.5px solid ${selectedBus === 'BUS-4521' ? colors.brand.primary : colors.border.subtle}`,
                    borderRadius: borderRadius.lg,
                    padding: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: shadows.subtle,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Bus Icon Container */}
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: borderRadius.md,
                        backgroundColor: '#e6f4ea',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                      }}
                    >
                      🚌
                    </div>

                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: colors.text.primary }}>
                        BUS-4521
                      </div>
                      <div style={{ fontSize: 12, color: colors.text.secondary }}>
                        {origin} → {destination} · Ramesh Sahoo
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: isBusOnline ? '#16a34a' : '#64748b',
                        display: 'inline-block',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isBusOnline ? '#16a34a' : '#64748b',
                      }}
                    >
                      {isBusOnline ? 'online' : 'offline'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Seat Selection & Hold Modal Card */}
              {selectedBus && !bookingConfirmed && (
                <div
                  style={{
                    backgroundColor: '#f8faf9',
                    border: `1.5px solid ${colors.border.subtle}`,
                    borderRadius: borderRadius.lg,
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: colors.text.primary }}>
                      Select Seat (2x2 Layout)
                    </span>
                    {selectedSeat && (
                      <span
                        style={{
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          padding: '2px 8px',
                          borderRadius: borderRadius.sm,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        ⏱️ Hold: {formatTimer(holdTimer)}
                      </span>
                    )}
                  </div>

                  {/* 2x2 Seating Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr) 20px repeat(2, 1fr)',
                      gap: 6,
                      maxHeight: 180,
                      overflowY: 'auto',
                      padding: '8px',
                      backgroundColor: '#ffffff',
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.border.subtle}`,
                    }}
                  >
                    {Array.from({ length: 40 }).map((_, idx) => {
                      const seatNum = idx + 1;
                      const isLocked = lockedSeats.includes(seatNum);
                      const isSelected = selectedSeat === seatNum;
                      const isAisle = (idx + 1) % 4 === 2;

                      return (
                        <React.Fragment key={seatNum}>
                          <button
                            type="button"
                            onClick={() => handleSeatClick(seatNum)}
                            disabled={isLocked}
                            style={{
                              height: 32,
                              backgroundColor: isSelected
                                ? '#16a34a'
                                : isLocked
                                ? '#fee2e2'
                                : '#f1f5f2',
                              border: isSelected
                                ? '1.5px solid #14532d'
                                : isLocked
                                ? '1px solid #fca5a5'
                                : `1px solid #d5e2d8`,
                              color: isSelected ? '#ffffff' : isLocked ? '#dc2626' : colors.text.primary,
                              fontWeight: 700,
                              fontSize: 11,
                              borderRadius: borderRadius.sm,
                              cursor: isLocked ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {seatNum}
                          </button>
                          {isAisle && <div style={{ width: 20, textAlign: 'center', color: '#94a3b8', fontSize: 9 }}>·</div>}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Book Button */}
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, color: colors.text.secondary }}>Seat #{selectedSeat || '-'}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: colors.text.primary }}>Fare: ₹60.00</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirmBooking}
                      disabled={!selectedSeat}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: selectedSeat ? '#16a34a' : '#cbd5e1',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: 13,
                        border: 'none',
                        borderRadius: borderRadius.md,
                        cursor: selectedSeat ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Book Ticket (₹60) →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Pay / Digital Ticket Screen */}
          {activeTab === 'PAY' && (
            <div
              style={{
                backgroundColor: '#f8faf9',
                border: `2px solid #16a34a`,
                borderRadius: borderRadius.xl,
                padding: 20,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 4 }}>🎟️</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#15803d', margin: 0 }}>
                RuralBus Digital Ticket
              </h3>
              <p style={{ fontSize: 12, color: colors.text.secondary, margin: '2px 0 16px 0' }}>
                Show this QR code to the bus conductor upon boarding
              </p>

              {/* QR Container */}
              <div
                style={{
                  width: 170,
                  height: 170,
                  margin: '0 auto 16px auto',
                  backgroundColor: '#ffffff',
                  borderRadius: borderRadius.lg,
                  border: '2px solid #16a34a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: shadows.subtle,
                }}
              >
                <div style={{ fontSize: 64 }}>📱</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', marginTop: 4 }}>
                  TKT-TRIP4521-S{selectedSeat || 14}
                </div>
              </div>

              <div
                style={{
                  textAlign: 'left',
                  backgroundColor: '#ffffff',
                  borderRadius: borderRadius.md,
                  padding: 12,
                  fontSize: 12,
                  lineHeight: 1.6,
                  border: `1px solid ${colors.border.subtle}`,
                }}
              >
                <div><strong>Passenger:</strong> Priya Das (9876500001)</div>
                <div><strong>Bus:</strong> BUS-4521 (Rural Express)</div>
                <div><strong>Route:</strong> {origin} → {destination}</div>
                <div><strong>Seat Number:</strong> #{selectedSeat || 14}</div>
                <div><strong>Fare Paid:</strong> ₹60.00 (Confirmed)</div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('BUSES')}
                style={{
                  marginTop: 14,
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13,
                  border: 'none',
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                }}
              >
                ← Back to Live Buses
              </button>
            </div>
          )}

          {activeTab === 'FEEDBACK' && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.text.primary }}>Passenger Support & Feedback</h3>
              <p style={{ fontSize: 13, color: colors.text.secondary }}>
                Depot Helpline: 1800-RURAL-BUS (Toll Free)
              </p>
            </div>
          )}

          {activeTab === 'EXIT' && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.text.primary }}>Signed In as Priya Das</h3>
              <p style={{ fontSize: 13, color: colors.text.secondary }}>
                Phone: 9876500001 · Rural Passenger Network
              </p>
            </div>
          )}
        </div>

        {/* Bottom Navigation Bar - Matches Screenshot 3 */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#ffffff',
            borderTop: `1.5px solid ${colors.border.subtle}`,
            padding: '8px 0',
          }}
        >
          {[
            { id: 'BUSES', label: 'Buses', icon: '🚌' },
            { id: 'PAY', label: 'Pay', icon: '₹' },
            { id: 'FEEDBACK', label: 'Feedback', icon: '★' },
            { id: 'EXIT', label: 'Exit', icon: '↩' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: isActive ? '#16a34a' : colors.text.secondary,
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 11,
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 16 }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

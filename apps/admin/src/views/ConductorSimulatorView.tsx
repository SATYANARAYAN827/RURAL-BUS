import { useState } from 'react';
import { colors, spacing, borderRadius, shadows } from '@ruralbus/ui';

export function ConductorSimulatorView() {
  const [activeTab, setActiveTab] = useState<'SCANNER' | 'POS' | 'MANIFEST'>('SCANNER');
  const [scanResult, setScanResult] = useState<{
    status: 'VALID' | 'DUPLICATE';
    passenger: string;
    seatNumber: number;
    destination: string;
    ticketId: string;
  } | null>({
    status: 'VALID',
    passenger: 'Priya Das',
    seatNumber: 14,
    destination: 'Destination Stop',
    ticketId: 'TKT-TRIP4521-S14',
  });

  const [cashBoardingStop, setCashBoardingStop] = useState('Stop A');
  const [cashDestination, setCashDestination] = useState('Destination Stop');
  const [passengerCount, setPassengerCount] = useState(1);
  const [issuedCashTickets, setIssuedCashTickets] = useState([
    {
      code: 'TKT-CASH-DEV1-TRIP4521-0001',
      passengerCount: 1,
      fare: 35,
      timestamp: '07:15 AM',
      hash: 'sha256:7f83b165...e92',
    },
  ]);

  const [manifest] = useState([
    { seat: 3, name: 'Sanjay Behera', stop: 'Stop A', status: 'BOARDED', ticket: 'TKT-03' },
    { seat: 7, name: 'Mamata Nayak', stop: 'Stop A', status: 'BOARDED', ticket: 'TKT-07' },
    { seat: 12, name: 'Bikash Mohanty', stop: 'Stop B', status: 'BOARDED', ticket: 'TKT-12' },
    { seat: 14, name: 'Priya Das', stop: 'Stop B', status: 'CONFIRMED', ticket: 'TKT-14' },
    { seat: 22, name: 'Debashis Jena', stop: 'Stop C', status: 'CONFIRMED', ticket: 'TKT-22' },
  ]);

  const handleIssueCashTicket = () => {
    const nextSeq = String(issuedCashTickets.length + 1).padStart(4, '0');
    const newTicket = {
      code: `TKT-CASH-DEV1-TRIP4521-${nextSeq}`,
      passengerCount,
      fare: 35 * passengerCount,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hash: `sha256:${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`,
    };
    setIssuedCashTickets([newTicket, ...issuedCashTickets]);
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
      {/* Conductor Mobile Container - RuralBus Visual Direction */}
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
          padding: '24px 20px',
          gap: 16,
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, color: colors.text.secondary, fontWeight: 500 }}>
              Namaskar, conductor
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: colors.text.primary, margin: '2px 0 0 0' }}>
              Vijay Patel
            </h2>
          </div>

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
            V
          </div>
        </div>

        {/* Route Banner Pill */}
        <div
          style={{
            backgroundColor: '#166534',
            color: '#ffffff',
            borderRadius: borderRadius.full,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span>📍</span>
          <span>Origin</span>
          <span style={{ color: '#86efac' }}>-------------→</span>
          <span>📍</span>
          <span>Destination</span>
        </div>

        {/* Tab Controls */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#f1f5f2',
            padding: '4px',
            borderRadius: borderRadius.lg,
            gap: 4,
          }}
        >
          {[
            { id: 'SCANNER', label: '📷 QR Scanner' },
            { id: 'POS', label: '🖨️ Cash POS' },
            { id: 'MANIFEST', label: '📋 Manifest' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  backgroundColor: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#16a34a' : colors.text.secondary,
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 12,
                  border: 'none',
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  boxShadow: isActive ? shadows.subtle : 'none',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Mode 1: QR Scanner */}
        {activeTab === 'SCANNER' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Viewport Frame */}
            <div
              style={{
                height: 190,
                backgroundColor: '#14291c',
                borderRadius: borderRadius.lg,
                border: '2.5px dashed #22c55e',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: 48 }}>📷</div>
              <span style={{ fontSize: 12, color: '#86efac', fontWeight: 600, marginTop: 6 }}>
                Align Passenger QR Code
              </span>
            </div>

            {/* Test Scanner Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() =>
                  setScanResult({
                    status: 'VALID',
                    passenger: 'Priya Das',
                    seatNumber: 14,
                    destination: 'Destination Stop',
                    ticketId: 'TKT-TRIP4521-S14',
                  })
                }
                style={{
                  padding: '9px',
                  backgroundColor: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  color: '#15803d',
                  fontWeight: 700,
                  borderRadius: borderRadius.md,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✓ Valid Ticket
              </button>

              <button
                type="button"
                onClick={() =>
                  setScanResult({
                    status: 'DUPLICATE',
                    passenger: 'Sanjay Behera (Boarded)',
                    seatNumber: 3,
                    destination: 'Destination Stop',
                    ticketId: 'TKT-03',
                  })
                }
                style={{
                  padding: '9px',
                  backgroundColor: '#fef2f2',
                  border: '1.5px solid #fca5a5',
                  color: '#b91c1c',
                  fontWeight: 700,
                  borderRadius: borderRadius.md,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✕ Duplicate Scan
              </button>
            </div>

            {/* Validation Result Box */}
            {scanResult && (
              <div
                style={{
                  padding: 14,
                  backgroundColor: scanResult.status === 'VALID' ? '#f0fdf4' : '#fef2f2',
                  border: `2px solid ${scanResult.status === 'VALID' ? '#16a34a' : '#ef4444'}`,
                  borderRadius: borderRadius.lg,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 32 }}>{scanResult.status === 'VALID' ? '✅' : '🚫'}</div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: scanResult.status === 'VALID' ? '#15803d' : '#b91c1c',
                    margin: '4px 0',
                  }}
                >
                  {scanResult.status === 'VALID' ? 'BOARDING APPROVED' : 'DUPLICATE REJECTED'}
                </div>
                <div style={{ fontSize: 12, color: colors.text.secondary, textAlign: 'left', marginTop: 8, lineHeight: 1.6 }}>
                  <div><strong>Passenger:</strong> {scanResult.passenger}</div>
                  <div><strong>Seat:</strong> #{scanResult.seatNumber}</div>
                  <div><strong>Destination:</strong> {scanResult.destination}</div>
                  <div><strong>Ticket:</strong> {scanResult.ticketId}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mode 2: Cash POS */}
        {activeTab === 'POS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                backgroundColor: '#f8faf9',
                border: `1.5px solid ${colors.border.subtle}`,
                borderRadius: borderRadius.lg,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div>
                <label style={{ fontSize: 11, color: colors.text.secondary, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Boarding Stop
                </label>
                <select
                  value={cashBoardingStop}
                  onChange={(e) => setCashBoardingStop(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#ffffff',
                    border: `1.5px solid ${colors.border.subtle}`,
                    borderRadius: borderRadius.md,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <option>Stop A</option>
                  <option>Stop B</option>
                  <option>Stop C</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: colors.text.secondary, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Destination Stop
                </label>
                <select
                  value={cashDestination}
                  onChange={(e) => setCashDestination(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#ffffff',
                    border: `1.5px solid ${colors.border.subtle}`,
                    borderRadius: borderRadius.md,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <option>Destination Stop</option>
                  <option>Stop B</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: colors.text.secondary, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Pass Count
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setPassengerCount(count)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: passengerCount === count ? '#16a34a' : '#ffffff',
                        color: passengerCount === count ? '#ffffff' : colors.text.primary,
                        fontWeight: 700,
                        border: `1.5px solid ${passengerCount === count ? '#166534' : colors.border.subtle}`,
                        borderRadius: borderRadius.md,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleIssueCashTicket}
                style={{
                  marginTop: 6,
                  padding: '12px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13,
                  border: 'none',
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                }}
              >
                🖨️ Issue Cash Ticket (₹{35 * passengerCount}.00)
              </button>
            </div>

            {/* Thermal Receipt Preview */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px dashed #94a3b8',
                borderRadius: borderRadius.md,
                padding: 12,
                fontFamily: 'Courier, monospace',
                fontSize: 11,
                lineHeight: 1.4,
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 'bold', borderBottom: '1px dashed #000', paddingBottom: 4, marginBottom: 4 }}>
                RURALBUS - RURAL TRANSIT
              </div>
              <div>TKT: {issuedCashTickets[0]?.code}</div>
              <div>BUS: BUS-4521</div>
              <div>FROM: {cashBoardingStop}</div>
              <div>TO:   {cashDestination}</div>
              <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>TOTAL:</span>
                <span>Rs {35 * passengerCount}.00 (CASH)</span>
              </div>
              <div style={{ fontSize: 9, wordBreak: 'break-all', textAlign: 'center', marginTop: 4 }}>
                HASH: {issuedCashTickets[0]?.hash}
              </div>
            </div>
          </div>
        )}

        {/* Mode 3: Manifest */}
        {activeTab === 'MANIFEST' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text.primary }}>
              Trip Manifest · BUS-4521
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {manifest.map((item) => (
                <div
                  key={item.seat}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: '#f8faf9',
                    border: `1px solid ${colors.border.subtle}`,
                    borderRadius: borderRadius.md,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 800, color: '#16a34a', marginRight: 6 }}>#{item.seat}</span>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <div style={{ fontSize: 10, color: colors.text.secondary }}>{item.stop}</div>
                  </div>

                  <span
                    style={{
                      padding: '2px 6px',
                      backgroundColor: item.status === 'BOARDED' ? '#dcfce7' : '#e0f2fe',
                      color: item.status === 'BOARDED' ? '#15803d' : '#0369a1',
                      borderRadius: borderRadius.sm,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

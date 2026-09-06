import { useState, useEffect } from 'react';
import { colors, spacing, borderRadius, shadows } from '@ruralbus/ui';

export function DriverSimulatorView() {
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [isGpsSharing, setIsGpsSharing] = useState(true);
  const [speed, setSpeed] = useState(48);
  const [occupancy] = useState(28);
  const [totalSeats] = useState(42);
  const [nextStop] = useState('Next Stop');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCoords(null)
      );
    }
  }, []);

  // Speed and telemetry simulation
  useEffect(() => {
    if (isCheckedIn && isGpsSharing) {
      const interval = setInterval(() => {
        setSpeed(Math.floor(42 + Math.random() * 14));
        setCoords((prev) => prev ? ({
          lat: Number((prev.lat + 0.0001).toFixed(4)),
          lng: Number((prev.lng + 0.0001).toFixed(4)),
        }) : null);
      }, 2500);
      return () => clearInterval(interval);
    } else {
      setSpeed(0);
    }
  }, [isCheckedIn, isGpsSharing]);

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
      {/* Driver Mobile Card Container - Matches Screenshot 1 */}
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
        {/* Header: Driver Name & Avatar - Matches Screenshot 1 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, color: colors.text.secondary, fontWeight: 500 }}>
              Namaskar, driver
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: colors.text.primary, margin: '2px 0 0 0' }}>
              Ramesh Sahoo
            </h2>
          </div>

          {/* Circular Avatar 'R' */}
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
            R
          </div>
        </div>

        {/* Route Banner Pill - Matches Screenshot 1 */}
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
            boxShadow: '0 2px 6px rgba(22, 101, 52, 0.25)',
          }}
        >
          <span>📍</span>
          <span>Origin</span>
          <span style={{ color: '#86efac' }}>-------------→</span>
          <span>📍</span>
          <span>Destination</span>
        </div>

        {/* Bus & Telemetry Controls Card - Matches Screenshot 1 */}
        <div
          style={{
            backgroundColor: '#f8faf9',
            border: `1.5px solid ${colors.border.subtle}`,
            borderRadius: borderRadius.lg,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Registration & Offline/Online Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: colors.text.primary }}>
                BUS-4521
              </div>
              <div style={{ fontSize: 12, color: colors.text.secondary }}>
                Rural Express · 28 km
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: isGpsSharing ? '#16a34a' : '#64748b',
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isGpsSharing ? '#16a34a' : '#64748b',
                }}
              >
                {isGpsSharing ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* GPS Sharing Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.text.primary }}>
                GPS sharing
              </div>
              <div style={{ fontSize: 11, color: colors.text.secondary }}>
                Uses this phone to show the bus on the map
              </div>
            </div>

            {/* iOS-Style Toggle Switch */}
            <button
              type="button"
              onClick={() => setIsGpsSharing(!isGpsSharing)}
              style={{
                width: 48,
                height: 26,
                borderRadius: borderRadius.full,
                backgroundColor: isGpsSharing ? '#16a34a' : '#cbd5e1',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background-color 0.2s',
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: 2,
                  left: isGpsSharing ? 24 : 2,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              />
            </button>
          </div>

          {/* Check In / Check Out Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setIsCheckedIn(true);
                setIsGpsSharing(true);
              }}
              style={{
                padding: '12px',
                backgroundColor: isCheckedIn ? '#16a34a' : '#e2e8f0',
                color: isCheckedIn ? '#ffffff' : colors.text.secondary,
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                borderRadius: borderRadius.md,
                cursor: 'pointer',
                boxShadow: isCheckedIn ? '0 2px 4px rgba(22, 163, 74, 0.3)' : 'none',
              }}
            >
              Check In
            </button>

            <button
              type="button"
              onClick={() => {
                setIsCheckedIn(false);
                setIsGpsSharing(false);
              }}
              style={{
                padding: '12px',
                backgroundColor: !isCheckedIn ? '#ef4444' : '#e2e8f0',
                color: !isCheckedIn ? '#ffffff' : colors.text.secondary,
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                borderRadius: borderRadius.md,
                cursor: 'pointer',
              }}
            >
              Check Out
            </button>
          </div>

          {/* 3 Metric Counters in a Row - Matches Screenshot 1 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              textAlign: 'center',
              borderTop: `1px solid ${colors.border.subtle}`,
              paddingTop: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: colors.text.primary }}>
                {speed}
              </div>
              <div style={{ fontSize: 11, color: colors.text.secondary }}>km/h</div>
            </div>

            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: colors.text.primary }}>
                {occupancy}/{totalSeats}
              </div>
              <div style={{ fontSize: 11, color: colors.text.secondary }}>seats</div>
            </div>

            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: colors.text.primary }}>
                {nextStop}
              </div>
              <div style={{ fontSize: 11, color: colors.text.secondary }}>next stop</div>
            </div>
          </div>
        </div>

        {/* Live position Card - Matches Screenshot 1 */}
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
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.text.primary }}>
            Live position
          </div>

          {/* Stylized Curved Route Map Illustration */}
          <div
            style={{
              position: 'relative',
              height: 240,
              backgroundColor: '#d8eedb',
              borderRadius: borderRadius.md,
              overflow: 'hidden',
              border: '1px solid #c2e2c7',
            }}
          >
            {/* Background Rolling Hills Elements */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                width: 140,
                height: 90,
                borderRadius: '50%',
                backgroundColor: '#c1e5c6',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 160,
                height: 100,
                borderRadius: '50%',
                backgroundColor: '#c1e5c6',
              }}
            />

            {/* Road SVG Curve */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              <path
                d="M 50 200 Q 150 160 180 120 T 320 50"
                fill="none"
                stroke="#1e3a29"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M 50 200 Q 150 160 180 120 T 320 50"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeDasharray="6,6"
              />
            </svg>

            {/* Stop Labels along curve */}
            <div
              style={{
                position: 'absolute',
                left: 60,
                top: 195,
                backgroundColor: '#ffffff',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                color: colors.text.primary,
                boxShadow: shadows.subtle,
              }}
            >
              Stop 1
            </div>

            <div
              style={{
                position: 'absolute',
                left: 120,
                top: 145,
                backgroundColor: '#ffffff',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                color: colors.text.primary,
                boxShadow: shadows.subtle,
              }}
            >
              Stop 2
            </div>

            <div
              style={{
                position: 'absolute',
                left: 170,
                top: 110,
                backgroundColor: '#ffffff',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                color: colors.text.primary,
                boxShadow: shadows.subtle,
              }}
            >
              Stop 3
            </div>

            <div
              style={{
                position: 'absolute',
                left: 230,
                top: 85,
                backgroundColor: '#ffffff',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                color: colors.text.primary,
                boxShadow: shadows.subtle,
              }}
            >
              Stop 4
            </div>

            <div
              style={{
                position: 'absolute',
                right: 25,
                top: 35,
                backgroundColor: '#ffffff',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                color: colors.text.primary,
                boxShadow: shadows.subtle,
              }}
            >
              Terminal
            </div>

            {/* Bus Position Marker */}
            <div
              style={{
                position: 'absolute',
                left: isGpsSharing ? 135 : 45,
                top: isGpsSharing ? 130 : 185,
                backgroundColor: '#166534',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: borderRadius.sm,
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                transition: 'all 0.5s ease',
              }}
            >
              <span>🚌</span>
              <span>BUS</span>
            </div>

            {/* Bottom Status Bubble */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                backgroundColor: isGpsSharing ? '#166534' : '#ffffff',
                color: isGpsSharing ? '#ffffff' : colors.text.primary,
                padding: '6px 12px',
                borderRadius: borderRadius.md,
                fontSize: 11,
                fontWeight: 600,
                boxShadow: shadows.subtle,
              }}
            >
              {isGpsSharing ? '● Sharing live location (4G GPS)' : 'Not sharing live location'}
            </div>
          </div>

          {/* Coordinates Footer - Matches Screenshot 1 */}
          <div style={{ fontSize: 11, color: colors.text.tertiary, textAlign: 'center' }}>
            {coords ? `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E · GPS Accuracy ±2.8m` : 'Waiting for device GPS'}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { SeatMapEntry } from '@ruralbus/shared-types';

interface SeatGridProps {
  seats: SeatMapEntry[];
  selectedSeatNumber: number | null;
  onSelectSeat: (seatNumber: number) => void;
}

export function SeatGrid({ seats, selectedSeatNumber, onSelectSeat }: SeatGridProps) {
  // Group seats into 2x2 rows (left 2, aisle, right 2)
  const rows: SeatMapEntry[][] = [];
  for (let i = 0; i < seats.length; i += 4) {
    rows.push(seats.slice(i, i + 4));
  }

  const getSeatColor = (seat: SeatMapEntry, isSelected: boolean) => {
    if (isSelected || seat.status === 'YOUR_HOLD') {
      return { bg: '#2563eb', border: '#60a5fa', text: '#ffffff' };
    }
    if (seat.status === 'CONFIRMED') {
      return { bg: '#1e293b', border: '#334155', text: '#64748b' };
    }
    if (seat.status === 'HELD') {
      return { bg: '#78350f', border: '#b45309', text: '#fde68a' };
    }
    return { bg: '#064e3b', border: '#059669', text: '#34d399' };
  };

  return (
    <div
      style={{
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.border.subtle}`,
        padding: spacing.lg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Driver Cabin Indicator */}
      <div
        style={{
          width: '100%',
          maxWidth: 280,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: spacing.md,
          borderBottom: `2px dashed ${colors.border.subtle}`,
          marginBottom: spacing.lg,
        }}
      >
        <span style={{ fontSize: 12, color: colors.text.tertiary, fontWeight: 600 }}>FRONT ENTRANCE</span>
        <div
          style={{
            padding: '4px 10px',
            backgroundColor: colors.background.tertiary,
            borderRadius: borderRadius.sm,
            fontSize: 12,
            fontWeight: 'bold',
            color: colors.text.secondary,
          }}
        >
          🛞 Driver
        </div>
      </div>

      {/* Seating Layout (2x2 with Central Aisle) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, width: '100%', maxWidth: 280 }}>
        {rows.map((row, rowIdx) => {
          const leftPair = row.slice(0, 2);
          const rightPair = row.slice(2, 4);

          return (
            <div key={rowIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Left Pair */}
              <div style={{ display: 'flex', gap: spacing.sm }}>
                {leftPair.map((seat) => {
                  const isSelected = selectedSeatNumber === seat.seatNumber;
                  const isClickable = seat.status === 'AVAILABLE' || seat.status === 'YOUR_HOLD';
                  const style = getSeatColor(seat, isSelected);

                  return (
                    <button
                      key={seat.seatNumber}
                      disabled={!isClickable}
                      onClick={() => onSelectSeat(seat.seatNumber)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: borderRadius.md,
                        backgroundColor: style.bg,
                        border: `2px solid ${style.border}`,
                        color: style.text,
                        fontWeight: 'bold',
                        fontSize: 13,
                        cursor: isClickable ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{seat.seatNumber}</span>
                    </button>
                  );
                })}
              </div>

              {/* Center Aisle */}
              <div style={{ width: 24, textAlign: 'center', fontSize: 10, color: colors.text.tertiary }}>
                ·
              </div>

              {/* Right Pair */}
              <div style={{ display: 'flex', gap: spacing.sm }}>
                {rightPair.map((seat) => {
                  const isSelected = selectedSeatNumber === seat.seatNumber;
                  const isClickable = seat.status === 'AVAILABLE' || seat.status === 'YOUR_HOLD';
                  const style = getSeatColor(seat, isSelected);

                  return (
                    <button
                      key={seat.seatNumber}
                      disabled={!isClickable}
                      onClick={() => onSelectSeat(seat.seatNumber)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: borderRadius.md,
                        backgroundColor: style.bg,
                        border: `2px solid ${style.border}`,
                        color: style.text,
                        fontWeight: 'bold',
                        fontSize: 13,
                        cursor: isClickable ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{seat.seatNumber}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Seat Color Legend */}
      <div
        style={{
          display: 'flex',
          gap: spacing.md,
          marginTop: spacing.xl,
          paddingTop: spacing.md,
          borderTop: `1px solid ${colors.border.subtle}`,
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#064e3b', border: '1px solid #059669' }} />
          <span>Available</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#2563eb', border: '1px solid #60a5fa' }} />
          <span>Selected</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#78350f', border: '1px solid #b45309' }} />
          <span>Reserved</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#1e293b', border: '1px solid #334155' }} />
          <span>Booked</span>
        </div>
      </div>
    </div>
  );
}

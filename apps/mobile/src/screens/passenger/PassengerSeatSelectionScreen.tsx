import React, { useState, useEffect } from 'react';
import { fetchSeatMap, holdSeatApi, releaseHoldApi } from '../../services/booking.api.js';
import { createPaymentOrderApi, verifyPaymentApi } from '../../services/payment.api.js';
import { SeatGrid } from '../../components/SeatGrid.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { AvailableTripResult, TripSeatMapResponse, SeatHoldResponse, PaymentVerificationResponse } from '@ruralbus/shared-types';

interface Props {
  trip: AvailableTripResult;
  onBack: () => void;
  onHoldSuccess: (hold: SeatHoldResponse) => void;
}

export function PassengerSeatSelectionScreen({ trip, onBack, onHoldSuccess }: Props) {
  const [seatMap, setSeatMap] = useState<TripSeatMapResponse | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [holding, setHolding] = useState(false);
  const [paying, setPaying] = useState(false);
  const [activeHold, setActiveHold] = useState<SeatHoldResponse | null>(null);
  const [confirmedPayment, setConfirmedPayment] = useState<PaymentVerificationResponse | null>(null);
  const [holdTimeRemaining, setHoldTimeRemaining] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMap = async () => {
    try {
      const data = await fetchSeatMap(trip.tripId);
      setSeatMap(data);
    } catch {
      setErrorMsg('Failed to load seat map');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMap();
  }, [trip.tripId]);

  // Hold Timer countdown
  useEffect(() => {
    if (!activeHold || confirmedPayment) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(activeHold.lockedUntil).getTime() - Date.now()) / 1000));
      setHoldTimeRemaining(remaining);
      if (remaining === 0) {
        setActiveHold(null);
        setSelectedSeat(null);
        loadMap();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeHold, confirmedPayment]);

  const handleHoldSeat = async () => {
    if (!selectedSeat) return;
    setHolding(true);
    setErrorMsg(null);

    try {
      const hold = await holdSeatApi({
        tripId: trip.tripId,
        seatNumber: selectedSeat,
        boardingStopId: trip.originStop.stopId,
        droppingStopId: trip.destinationStop.stopId,
      });
      setActiveHold(hold);
      setHoldTimeRemaining(hold.expiresInSeconds);
      await loadMap();
      onHoldSuccess(hold);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to lock seat. Please try another.';
      setErrorMsg(msg);
      setSelectedSeat(null);
      await loadMap();
    } finally {
      setHolding(false);
    }
  };

  const handleReleaseHold = async () => {
    if (!activeHold) return;
    try {
      await releaseHoldApi(activeHold.bookingId);
      setActiveHold(null);
      setSelectedSeat(null);
      await loadMap();
    } catch {
      // Ignore
    }
  };

  const handleProceedToPayment = async () => {
    if (!activeHold) return;
    setPaying(true);
    setErrorMsg(null);

    try {
      // 1. Create Razorpay order
      const order = await createPaymentOrderApi(activeHold.bookingId);

      // 2. Simulate Razorpay payment completion & signature
      const verification = await verifyPaymentApi({
        bookingId: activeHold.bookingId,
        razorpayOrderId: order.orderId,
        razorpayPaymentId: `pay_mock_${Date.now()}`,
        razorpaySignature: 'sig_mock_verified',
      });

      setConfirmedPayment(verification);
      await loadMap();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Payment processing failed';
      setErrorMsg(msg);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>
        Loading interactive seating layout...
      </div>
    );
  }

  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <button
          onClick={onBack}
          style={{
            padding: '6px 12px',
            backgroundColor: colors.background.tertiary,
            border: `1px solid ${colors.border.subtle}`,
            borderRadius: borderRadius.md,
            color: colors.text.primary,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <div>
          <span style={{ fontSize: 12, color: colors.brand.primary, fontWeight: 600 }}>SELECT SEAT</span>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>
            Seat Selection ({trip.busModel})
          </h2>
        </div>
      </div>

      {/* Confirmed Payment Success Banner */}
      {confirmedPayment && (
        <div
          style={{
            backgroundColor: '#064e3b',
            border: '1px solid #059669',
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: spacing.xs }}>🎟️</div>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#34d399' }}>
            Ticket Confirmed & Issued!
          </div>
          <p style={{ fontSize: 13, color: '#a7f3d0', margin: '4px 0 12px 0' }}>
            Seat #{activeHold?.seatNumber} reserved on Route {trip.routeCode}.
          </p>
          <div
            style={{
              padding: '6px 12px',
              backgroundColor: '#0f172a',
              borderRadius: borderRadius.md,
              fontFamily: 'monospace',
              fontSize: 12,
              color: '#38bdf8',
              display: 'inline-block',
            }}
          >
            QR Token: {confirmedPayment.qrSignature.slice(0, 22)}...
          </div>
        </div>
      )}

      {/* Active Hold Banner */}
      {activeHold && !confirmedPayment && (
        <div
          style={{
            backgroundColor: '#1e3a8a',
            border: '1px solid #3b82f6',
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 14, color: '#93c5fd' }}>
              🔒 Seat {activeHold.seatNumber} Reserved For You
            </div>
            <div style={{ fontSize: 12, color: '#bfdbfe', marginTop: 2 }}>
              Hold expires in: <strong style={{ color: '#ffffff' }}>{Math.floor(holdTimeRemaining / 60)}:{(holdTimeRemaining % 60).toString().padStart(2, '0')}</strong>
            </div>
          </div>
          <button
            onClick={handleReleaseHold}
            style={{
              padding: '6px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              borderRadius: borderRadius.sm,
              color: '#f87171',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Release
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: borderRadius.md,
            padding: spacing.md,
            color: '#fca5a5',
            fontSize: 13,
            marginBottom: spacing.lg,
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Seating Grid */}
      {seatMap && (
        <SeatGrid
          seats={seatMap.seats}
          selectedSeatNumber={selectedSeat}
          onSelectSeat={(seatNum) => {
            if (!activeHold && !confirmedPayment) setSelectedSeat(seatNum);
          }}
        />
      )}

      {/* Bottom Action Footer */}
      {!confirmedPayment && (
        <div
          style={{
            marginTop: spacing.xl,
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.border.subtle}`,
            padding: spacing.lg,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: colors.text.secondary }}>Selected Seat</span>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: selectedSeat ? colors.brand.primary : colors.text.tertiary }}>
              {selectedSeat ? `Seat #${selectedSeat}` : 'None Selected'}
            </div>
            <span style={{ fontSize: 12, color: colors.text.secondary }}>Fare: ₹{trip.fareAmount}</span>
          </div>

          {!activeHold ? (
            <button
              disabled={!selectedSeat || holding}
              onClick={handleHoldSeat}
              style={{
                padding: '12px 24px',
                backgroundColor: selectedSeat ? colors.brand.primary : colors.background.tertiary,
                color: selectedSeat ? '#ffffff' : colors.text.tertiary,
                fontWeight: 'bold',
                fontSize: 14,
                border: 'none',
                borderRadius: borderRadius.md,
                cursor: selectedSeat && !holding ? 'pointer' : 'not-allowed',
              }}
            >
              {holding ? 'Locking Seat...' : 'Hold & Reserve (5m) →'}
            </button>
          ) : (
            <button
              disabled={paying}
              onClick={handleProceedToPayment}
              style={{
                padding: '12px 24px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: 14,
                border: 'none',
                borderRadius: borderRadius.md,
                cursor: paying ? 'wait' : 'pointer',
              }}
            >
              {paying ? 'Processing Payment...' : `Pay ₹${trip.fareAmount} via Razorpay →`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

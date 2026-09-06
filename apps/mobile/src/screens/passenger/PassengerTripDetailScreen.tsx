import React, { useState, useEffect } from 'react';
import { getTripDetails } from '../../services/discovery.api.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { PublicTripDetailResponse, AvailableTripResult } from '@ruralbus/shared-types';

interface Props {
  tripId: string;
  onBack: () => void;
  onSelectSeats: (trip: AvailableTripResult) => void;
}

export function PassengerTripDetailScreen({ tripId, onBack, onSelectSeats }: Props) {
  const [detail, setDetail] = useState<PublicTripDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getTripDetails(tripId)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [tripId]);

  if (loading) {
    return (
      <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>
        Loading live trip itinerary...
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>
        Trip not found.
        <button
          onClick={onBack}
          style={{
            display: 'block',
            margin: `${spacing.md}px auto`,
            padding: '8px 16px',
            backgroundColor: colors.brand.primary,
            border: 'none',
            borderRadius: borderRadius.md,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  const { trip, liveLocation } = detail;

  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary }}>
      {/* Top Bar */}
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
            fontSize: 13,
          }}
        >
          ← Back
        </button>
        <div>
          <span style={{ fontSize: 12, color: colors.brand.primary, fontWeight: 600 }}>{trip.operatorName}</span>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>
            {trip.origin} ➔ {trip.destination}
          </h2>
        </div>
      </div>

      {/* Live Bus Tracking Card */}
      <div
        style={{
          backgroundColor: '#0f172a',
          borderRadius: borderRadius.lg,
          border: `1px solid ${liveLocation ? '#10b981' : colors.border.subtle}`,
          padding: spacing.md,
          marginBottom: spacing.lg,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <span style={{ fontSize: 13, fontWeight: 'bold', color: '#f8fafc' }}>
            Live Vehicle Transponder ({trip.busRegistrationNumber})
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: borderRadius.full,
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: liveLocation ? '#064e3b' : colors.background.tertiary,
              color: liveLocation ? '#34d399' : colors.text.tertiary,
            }}
          >
            {liveLocation ? '● LIVE GPS CONNECTED' : 'GPS SCHEDULED'}
          </span>
        </div>

        {liveLocation ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            Speed: <strong style={{ color: '#38bdf8' }}>{liveLocation.speed} km/h</strong> · Heading: {liveLocation.heading}°
            <div style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 4, fontFamily: 'monospace' }}>
              Lat/Lng: {liveLocation.latitude.toFixed(4)}, {liveLocation.longitude.toFixed(4)} · Ping: {new Date(liveLocation.lastPingAt).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: colors.text.secondary }}>
            Bus is at depot / pre-departure. Live coordinates will stream upon departure.
          </div>
        )}
      </div>

      {/* Corridor Stops Timeline */}
      <div
        style={{
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.border.subtle}`,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 'bold', margin: '0 0 16px 0', color: colors.text.primary }}>
          Route Stops & Itinerary
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {trip.stops.map((stop, idx) => (
            <div key={stop.stopId} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: idx === 0 ? colors.brand.primary : idx === trip.stops.length - 1 ? '#ef4444' : colors.background.tertiary,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}
              >
                {stop.sequenceNumber}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.text.primary }}>{stop.stopName}</div>
                <div style={{ fontSize: 12, color: colors.text.secondary }}>
                  +{stop.estimatedMinutesFromStart} min from origin · {stop.distanceFromStartKm} km
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fare & Proceed CTA */}
      <div
        style={{
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
          <span style={{ fontSize: 12, color: colors.text.secondary }}>Fare per Passenger</span>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: colors.brand.primary }}>₹{trip.fareAmount}</div>
          <span style={{ fontSize: 11, color: '#34d399' }}>{trip.availableSeats} seats remaining</span>
        </div>
        <button
          onClick={() => onSelectSeats(trip)}
          style={{
            padding: '12px 24px',
            backgroundColor: colors.brand.primary,
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: 14,
            border: 'none',
            borderRadius: borderRadius.md,
            cursor: 'pointer',
          }}
        >
          Select Seats →
        </button>
      </div>
    </div>
  );
}

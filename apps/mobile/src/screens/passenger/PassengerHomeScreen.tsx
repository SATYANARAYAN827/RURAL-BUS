import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/auth.store.js';
import { searchTrips } from '../../services/discovery.api.js';
import { PassengerTripDetailScreen } from './PassengerTripDetailScreen.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { AvailableTripResult } from '@ruralbus/shared-types';

interface Props {
  onSelectSeats?: (trip: AvailableTripResult) => void;
}

export function PassengerHomeScreen({ onSelectSeats }: Props) {
  const { user } = useAuthStore();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [trips, setTrips] = useState<AvailableTripResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const result = await searchTrips({
        origin: origin.trim() || undefined,
        destination: destination.trim() || undefined,
      });
      setTrips(result.trips);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  if (selectedTripId) {
    return (
      <PassengerTripDetailScreen
        tripId={selectedTripId}
        onBack={() => setSelectedTripId(null)}
        onSelectSeats={(trip) => {
          if (onSelectSeats) onSelectSeats(trip);
        }}
      />
    );
  }

  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
        <div>
          <span style={{ fontSize: 13, color: colors.brand.primary, fontWeight: 600 }}>PASSENGER PORTAL</span>
          <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: '4px 0 0 0' }}>
            Hello, {user?.fullName || 'Traveler'} 👋
          </h1>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: colors.background.tertiary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            color: colors.brand.primary,
          }}
        >
          {user?.fullName?.charAt(0) || 'P'}
        </div>
      </div>

      {/* Search Route Card */}
      <div
        style={{
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.border.subtle}`,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: colors.text.primary, margin: '0 0 16px 0' }}>
          Find Bus Routes & Schedules
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <div>
            <label style={{ fontSize: 12, color: colors.text.secondary }}>From Stop / Origin</label>
            <input
              type="text"
              placeholder="e.g. Mysore, Majestic..."
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: colors.background.tertiary,
                border: `1px solid ${colors.border.subtle}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: 14,
                boxSizing: 'border-box',
                marginTop: 4,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: colors.text.secondary }}>To Stop / Destination</label>
            <input
              type="text"
              placeholder="e.g. Hunsur, Mandya..."
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: colors.background.tertiary,
                border: `1px solid ${colors.border.subtle}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: 14,
                boxSizing: 'border-box',
                marginTop: 4,
              }}
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: '12px 16px',
              backgroundColor: colors.brand.primary,
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 14,
              border: 'none',
              borderRadius: borderRadius.md,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: spacing.xs,
            }}
          >
            {loading ? 'Searching Corridor...' : 'Search Available Trips'}
          </button>
        </div>
      </div>

      {/* Available Trips List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Available Buses ({trips.length})</h2>
          <span style={{ fontSize: 12, color: colors.text.secondary }}>Real-Time Inventory</span>
        </div>

        {trips.map((trip) => (
          <div
            key={trip.tripId}
            onClick={() => setSelectedTripId(trip.tripId)}
            style={{
              backgroundColor: colors.background.secondary,
              borderRadius: borderRadius.lg,
              border: `1px solid ${colors.border.subtle}`,
              padding: spacing.md,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.brand.primary,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {trip.operatorName}
                </span>
                <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>
                  {trip.origin} ➔ {trip.destination}
                </div>
                <div style={{ fontSize: 12, color: colors.text.secondary, marginTop: 2 }}>
                  Route: {trip.routeCode} · Bus: {trip.busRegistrationNumber} ({trip.busModel})
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: colors.brand.primary }}>
                  ₹{trip.fareAmount}
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    backgroundColor: trip.availableSeats > 5 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: trip.availableSeats > 5 ? '#34d399' : '#f87171',
                    borderRadius: borderRadius.sm,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {trip.availableSeats} seats left
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: spacing.md,
                paddingTop: spacing.sm,
                borderTop: `1px solid ${colors.border.subtle}`,
                fontSize: 12,
                color: colors.text.secondary,
              }}
            >
              <div>
                🕒 Departs: {new Date(trip.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: trip.hasLiveGps ? '#34d399' : colors.text.tertiary }}>
                <span>●</span> {trip.hasLiveGps ? 'Live GPS Active' : 'Scheduled'}
              </div>
            </div>
          </div>
        ))}

        {trips.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.text.tertiary }}>
            No trips found for the selected corridor. Try clearing search filters.
          </div>
        )}
      </div>
    </div>
  );
}

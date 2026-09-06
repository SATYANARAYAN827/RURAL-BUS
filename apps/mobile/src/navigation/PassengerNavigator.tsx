import React, { useState } from 'react';
import { PassengerHomeScreen } from '../screens/passenger/PassengerHomeScreen.js';
import { LiveTrackingScreen } from '../screens/passenger/LiveTrackingScreen.js';
import { MyTicketsScreen } from '../screens/passenger/MyTicketsScreen.js';
import { PassengerProfileScreen } from '../screens/passenger/PassengerProfileScreen.js';
import { PassengerSeatSelectionScreen } from '../screens/passenger/PassengerSeatSelectionScreen.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { AvailableTripResult } from '@ruralbus/shared-types';

type Tab = 'HOME' | 'TRACKING' | 'TICKETS' | 'PROFILE';

export function PassengerNavigator() {
  const [activeTab, setActiveTab] = useState<Tab>('HOME');
  const [selectedTripForSeats, setSelectedTripForSeats] = useState<AvailableTripResult | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: colors.background.primary, fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, paddingBottom: 64 }}>
        {selectedTripForSeats ? (
          <PassengerSeatSelectionScreen
            trip={selectedTripForSeats}
            onBack={() => setSelectedTripForSeats(null)}
            onHoldSuccess={() => {
              // Could switch tab to tickets/checkout
            }}
          />
        ) : (
          <>
            {activeTab === 'HOME' && (
              <PassengerHomeScreen onSelectSeats={(trip) => setSelectedTripForSeats(trip)} />
            )}
            {activeTab === 'TRACKING' && <LiveTrackingScreen />}
            {activeTab === 'TICKETS' && <MyTicketsScreen />}
            {activeTab === 'PROFILE' && <PassengerProfileScreen />}
          </>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          backgroundColor: colors.background.secondary,
          borderTop: `1px solid ${colors.border.subtle}`,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 100,
        }}
      >
        <button
          onClick={() => {
            setSelectedTripForSeats(null);
            setActiveTab('HOME');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'HOME' && !selectedTripForSeats ? colors.brand.primary : colors.text.tertiary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: activeTab === 'HOME' && !selectedTripForSeats ? 'bold' : 'normal',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>🏠</span>
          <span>Home</span>
        </button>

        <button
          onClick={() => {
            setSelectedTripForSeats(null);
            setActiveTab('TRACKING');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'TRACKING' ? colors.brand.primary : colors.text.tertiary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: activeTab === 'TRACKING' ? 'bold' : 'normal',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>📍</span>
          <span>Live Map</span>
        </button>

        <button
          onClick={() => {
            setSelectedTripForSeats(null);
            setActiveTab('TICKETS');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'TICKETS' ? colors.brand.primary : colors.text.tertiary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: activeTab === 'TICKETS' ? 'bold' : 'normal',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>🎟️</span>
          <span>Tickets</span>
        </button>

        <button
          onClick={() => {
            setSelectedTripForSeats(null);
            setActiveTab('PROFILE');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'PROFILE' ? colors.brand.primary : colors.text.tertiary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: activeTab === 'PROFILE' ? 'bold' : 'normal',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>👤</span>
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
}

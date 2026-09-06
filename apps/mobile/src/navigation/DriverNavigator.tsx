import React, { useState } from 'react';
import { DriverDashboardScreen } from '../screens/driver/DriverDashboardScreen.js';
import { GpsTelemetryScreen } from '../screens/driver/GpsTelemetryScreen.js';
import { DriverHistoryScreen } from '../screens/driver/DriverHistoryScreen.js';
import { DriverProfileScreen } from '../screens/driver/DriverProfileScreen.js';
import { colors } from '@ruralbus/ui';

type Tab = 'HUD' | 'GPS' | 'HISTORY' | 'PROFILE';

export function DriverNavigator() {
  const [activeTab, setActiveTab] = useState<Tab>('HUD');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: colors.background.primary, fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, paddingBottom: 64 }}>
        {activeTab === 'HUD' && <DriverDashboardScreen />}
        {activeTab === 'GPS' && <GpsTelemetryScreen />}
        {activeTab === 'HISTORY' && <DriverHistoryScreen />}
        {activeTab === 'PROFILE' && <DriverProfileScreen />}
      </div>

      {/* Driver Bottom Tab Bar */}
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
          onClick={() => setActiveTab('HUD')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'HUD' ? colors.status.warning : colors.text.tertiary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: activeTab === 'HUD' ? 'bold' : 'normal',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>🚍</span>
          <span>Duty HUD</span>
        </button>

        <button
          onClick={() => setActiveTab('GPS')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'GPS' ? colors.status.warning : colors.text.tertiary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: activeTab === 'GPS' ? 'bold' : 'normal',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>📡</span>
          <span>Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'HISTORY' ? colors.status.warning : colors.text.tertiary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: activeTab === 'HISTORY' ? 'bold' : 'normal',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>📋</span>
          <span>Log</span>
        </button>

        <button
          onClick={() => setActiveTab('PROFILE')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'PROFILE' ? colors.status.warning : colors.text.tertiary,
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

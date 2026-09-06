import React, { useState } from 'react';
import { ConductorDashboardScreen } from '../screens/conductor/ConductorDashboardScreen.js';
import { TicketScannerScreen } from '../screens/conductor/TicketScannerScreen.js';
import { ConductorStatsScreen } from '../screens/conductor/ConductorStatsScreen.js';
import { ConductorProfileScreen } from '../screens/conductor/ConductorProfileScreen.js';
import { colors } from '@ruralbus/ui';

type Tab = 'MANIFEST' | 'SCANNER' | 'STATS' | 'PROFILE';

export function ConductorNavigator() {
  const [activeTab, setActiveTab] = useState<Tab>('MANIFEST');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: colors.background.primary, fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, paddingBottom: 64 }}>
        {activeTab === 'MANIFEST' && <ConductorDashboardScreen />}
        {activeTab === 'SCANNER' && <TicketScannerScreen />}
        {activeTab === 'STATS' && <ConductorStatsScreen />}
        {activeTab === 'PROFILE' && <ConductorProfileScreen />}
      </div>

      {/* Conductor Bottom Tab Bar */}
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
          onClick={() => setActiveTab('MANIFEST')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'MANIFEST' ? colors.status.info : colors.text.tertiary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: activeTab === 'MANIFEST' ? 'bold' : 'normal',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>📝</span>
          <span>Manifest</span>
        </button>

        <button
          onClick={() => setActiveTab('SCANNER')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'SCANNER' ? colors.status.info : colors.text.tertiary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: activeTab === 'SCANNER' ? 'bold' : 'normal',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>📷</span>
          <span>QR Check-in</span>
        </button>

        <button
          onClick={() => setActiveTab('STATS')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'STATS' ? colors.status.info : colors.text.tertiary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: activeTab === 'STATS' ? 'bold' : 'normal',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>💰</span>
          <span>Collections</span>
        </button>

        <button
          onClick={() => setActiveTab('PROFILE')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'PROFILE' ? colors.status.info : colors.text.tertiary,
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

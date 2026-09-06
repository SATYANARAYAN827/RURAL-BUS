import React from 'react';
import { colors, spacing, borderRadius } from '@ruralbus/ui';

export function LiveTrackingScreen() {
  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary }}>
      <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 16px 0' }}>Live Bus Tracking</h1>
      
      {/* Map Container */}
      <div
        style={{
          height: 280,
          backgroundColor: '#f8fafc',
          borderRadius: borderRadius.lg,
          border: `1.5px solid ${colors.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: spacing.lg,
        }}
      >
        <div style={{ fontSize: 36 }}>🗺️</div>
        <div style={{ fontSize: 14, color: colors.text.primary, fontWeight: 700, marginTop: 8 }}>
          Waiting for device GPS
        </div>
        <div style={{ fontSize: 11, color: colors.text.secondary, marginTop: 4 }}>
          Location not available
        </div>
      </div>

      {/* Vehicle Telemetry HUD */}
      <div
        style={{
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.lg,
          border: `1.5px solid ${colors.border.subtle}`,
          padding: spacing.md,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>No scheduled buses found</div>
            <div style={{ fontSize: 12, color: colors.text.secondary, marginTop: 2 }}>
              No live GPS telemetry broadcast available
            </div>
          </div>
          <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 800 }}>
            STANDBY
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${colors.border.subtle}`, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>--</div>
            <div style={{ fontSize: 10, color: colors.text.secondary }}>km/h</div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.text.secondary }}>No stops available</div>
            <div style={{ fontSize: 10, color: colors.text.secondary }}>Next Stop</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>--</div>
            <div style={{ fontSize: 10, color: colors.text.secondary }}>ETA</div>
          </div>
        </div>
      </div>
    </div>
  );
}


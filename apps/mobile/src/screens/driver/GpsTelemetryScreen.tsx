import React from 'react';
import { colors, spacing, borderRadius } from '@ruralbus/ui';

export function GpsTelemetryScreen() {
  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary }}>
      <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 16px 0' }}>GPS Telemetry Engine</h1>

      <div
        style={{
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.border.subtle}`,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: colors.brand.primary, display: 'inline-block' }}></span>
          <span style={{ fontSize: 14, fontWeight: 600, color: colors.brand.primary }}>Streaming to Redis & API WebSocket</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
          <div style={{ backgroundColor: colors.background.tertiary, padding: spacing.md, borderRadius: borderRadius.md }}>
            <div style={{ fontSize: 12, color: colors.text.secondary }}>Current Latitude</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>12.9774° N</div>
          </div>
          <div style={{ backgroundColor: colors.background.tertiary, padding: spacing.md, borderRadius: borderRadius.md }}>
            <div style={{ fontSize: 12, color: colors.text.secondary }}>Current Longitude</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>77.5729° E</div>
          </div>
          <div style={{ backgroundColor: colors.background.tertiary, padding: spacing.md, borderRadius: borderRadius.md }}>
            <div style={{ fontSize: 12, color: colors.text.secondary }}>Speed</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>54 km/h</div>
          </div>
          <div style={{ backgroundColor: colors.background.tertiary, padding: spacing.md, borderRadius: borderRadius.md }}>
            <div style={{ fontSize: 12, color: colors.text.secondary }}>Heading</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>215° SW</div>
          </div>
        </div>
      </div>
    </div>
  );
}

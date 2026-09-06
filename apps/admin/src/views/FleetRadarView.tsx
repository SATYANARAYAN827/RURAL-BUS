import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api.client.js';
import { colors, spacing, borderRadius, shadows } from '@ruralbus/ui';
import type { LiveFleetRadarResponse } from '@ruralbus/shared-types';

export function FleetRadarView() {
  const [selectedBusId, setSelectedBusId] = useState<string | null>('demo-bus-01');

  const { data: radarData, refetch } = useQuery<LiveFleetRadarResponse>({
    queryKey: ['fleet-radar'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/api/v1/tracking/fleet');
        return res.data.data;
      } catch {
        return null as any;
      }
    },
    refetchInterval: 5000,
  });

  const liveBuses = radarData?.buses || [];
  const displayBuses = liveBuses;

  const selectedBus = displayBuses.find((b) => b.busId === selectedBusId) || displayBuses[0] || null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.lg,
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: borderRadius.xl,
          border: `1.5px solid ${colors.border.subtle}`,
          padding: spacing.lg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: shadows.card,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: colors.text.primary }}>
            Live PostGIS & Redis Fleet Radar
          </h2>
          <p style={{ fontSize: 13, color: colors.text.secondary, margin: '4px 0 0 0' }}>
            Real-time geospatial telemetry streamed from active driver transponders (3s refresh).
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              backgroundColor: '#f0fdf4',
              color: '#15803d',
              borderRadius: borderRadius.full,
              fontSize: 13,
              fontWeight: 700,
              border: `1.5px solid #86efac`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#16a34a',
              }}
            />
            {displayBuses.length} Vehicles in Corridor
          </span>
          <button
            onClick={() => refetch()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.3)',
            }}
          >
            Sync Radar
          </button>
        </div>
      </div>

      {/* Main Grid: Radar Canvas + Live Fleet Table */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: spacing.lg,
        }}
      >
        {/* Visual Radar Map Grid */}
        <div
          style={{
            backgroundColor: '#14291c',
            borderRadius: borderRadius.xl,
            border: `1.5px solid ${colors.border.subtle}`,
            height: 480,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: spacing.md,
            boxSizing: 'border-box',
            boxShadow: shadows.card,
          }}
        >
          {/* Radar background grid lines */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage:
                'radial-gradient(circle, rgba(34, 197, 94, 0.2) 1px, transparent 1px), linear-gradient(to right, rgba(34, 197, 94, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(34, 197, 94, 0.08) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              pointerEvents: 'none',
            }}
          />

          {/* Radar Sweep Rings */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 320,
              height: 320,
              borderRadius: '50%',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 180,
              height: 180,
              borderRadius: '50%',
              border: '1px dashed rgba(34, 197, 94, 0.35)',
              pointerEvents: 'none',
            }}
          />

          {/* Radar Header Info */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#86efac', fontFamily: 'monospace', fontWeight: 'bold' }}>
              ACTIVE CORRIDOR: EPSG:4326 PostGIS GRID
            </span>
            <span style={{ fontSize: 12, color: '#bbf7d0', fontFamily: 'monospace' }}>
              {new Date().toLocaleTimeString()}
            </span>
          </div>

          {/* Active Bus Markers on Radar Canvas */}
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {displayBuses.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#86efac', fontFamily: 'monospace' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
                <div style={{ fontSize: 13, fontWeight: 'bold' }}>Waiting for device GPS</div>
                <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>No live bus transmissions active</div>
              </div>
            ) : (
              displayBuses.map((bus, idx) => {
                const isSelected = selectedBus?.busId === bus.busId;
                const leftPercent = 35 + (idx * 30);
                const topPercent = 35 + (idx * 25);

                return (
                  <div
                    key={bus.busId}
                    onClick={() => setSelectedBusId(bus.busId)}
                    style={{
                      position: 'absolute',
                      left: `${leftPercent}%`,
                      top: `${topPercent}%`,
                      transform: 'translate(-50%, -50%)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      zIndex: isSelected ? 10 : 3,
                    }}
                  >
                    <div
                      style={{
                        width: isSelected ? 36 : 28,
                        height: isSelected ? 36 : 28,
                        borderRadius: '50%',
                        backgroundColor: isSelected ? '#16a34a' : '#15803d',
                        border: '2px solid #ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isSelected ? 16 : 13,
                        boxShadow: isSelected ? '0 0 16px rgba(34, 197, 94, 0.9)' : '0 0 8px rgba(34, 197, 94, 0.5)',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      🚌
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        backgroundColor: 'rgba(5, 10, 15, 0.85)',
                        color: isSelected ? '#86efac' : '#cbd5e1',
                        padding: '2px 6px',
                        borderRadius: borderRadius.sm,
                        border: `1px solid ${isSelected ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {bus.registrationNumber} ({bus.speed} km/h)
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Bus HUD Overlay */}
          {selectedBus && (
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                backgroundColor: 'rgba(20, 41, 28, 0.95)',
                border: `1px solid #16a34a`,
                borderRadius: borderRadius.md,
                padding: spacing.sm,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                fontFamily: 'monospace',
                color: '#bbf7d0',
              }}
            >
              <div>
                <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{selectedBus.registrationNumber}</span> · {selectedBus.routeCode}
              </div>
              <div>
                Driver: <span style={{ color: '#86efac' }}>{selectedBus.driverName}</span> · Speed: <span style={{ color: '#34d399' }}>{selectedBus.speed} km/h</span>
              </div>
            </div>
          )}
        </div>

        {/* Live Transponder Fleet List */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: borderRadius.xl,
            border: `1.5px solid ${colors.border.subtle}`,
            padding: spacing.md,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 480,
            overflowY: 'auto',
            boxShadow: shadows.card,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: spacing.md, color: colors.text.primary }}>
            Telemetry Fleet Roster ({displayBuses.length})
          </div>

          {displayBuses.length === 0 ? (
            <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.text.secondary, fontSize: 13 }}>
              No scheduled buses found
            </div>
          ) : (
            displayBuses.map((bus) => {
              const isSelected = selectedBus?.busId === bus.busId;
              return (
                <div
                  key={bus.busId}
                  onClick={() => setSelectedBusId(bus.busId)}
                  style={{
                    padding: spacing.md,
                    borderRadius: borderRadius.lg,
                    backgroundColor: isSelected ? '#f0fdf4' : '#f8faf9',
                    border: `1.5px solid ${isSelected ? '#16a34a' : colors.border.subtle}`,
                    marginBottom: spacing.sm,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: colors.text.primary }}>
                      {bus.registrationNumber}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: borderRadius.full,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                      }}
                    >
                      ● 4G STREAMING
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: colors.text.secondary, marginTop: 4 }}>
                    Route: <strong>{bus.routeCode}</strong> · Driver: <strong>{bus.driverName}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 4, fontFamily: 'monospace' }}>
                    GPS: {bus.latitude.toFixed(4)}, {bus.longitude.toFixed(4)} · {bus.speed} km/h
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

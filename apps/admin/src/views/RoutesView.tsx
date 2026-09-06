import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchRoutes,
  createRoute,
  deleteRoute,
  fetchStops,
  createStop,
  deleteStop,
} from '../services/fleet.api.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';

export function RoutesView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ROUTES' | 'STOPS'>('ROUTES');

  // Modal States
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Stop Form State
  const [stopName, setStopName] = useState('');
  const [stopCode, setStopCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [landmark, setLandmark] = useState('');

  // Route Form State
  const [routeCode, setRouteCode] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedRouteStops, setSelectedRouteStops] = useState<
    Array<{
      stopId: string;
      sequenceNumber: number;
      distanceFromStartKm: number;
      estimatedMinutesFromStart: number;
      fareFromStart: number;
    }>
  >([]);

  // 1. Queries
  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['operatorRoutes'],
    queryFn: () => fetchRoutes(),
  });

  const { data: stopsData, isLoading: stopsLoading } = useQuery({
    queryKey: ['operatorStops'],
    queryFn: () => fetchStops(),
  });

  // 2. Mutations
  const createStopMutation = useMutation({
    mutationFn: () =>
      createStop({
        name: stopName,
        code: stopCode,
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
        landmark: landmark || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorStops'] });
      setShowAddStopModal(false);
      setStopName('');
      setStopCode('');
      setLatitude('');
      setLongitude('');
      setLandmark('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to create stop');
    },
  });

  const deleteStopMutation = useMutation({
    mutationFn: (stopId: string) => deleteStop(stopId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorStops'] });
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: () =>
      createRoute({
        routeCode,
        origin,
        destination,
        stops: selectedRouteStops,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorRoutes'] });
      setShowAddRouteModal(false);
      setRouteCode('');
      setOrigin('');
      setDestination('');
      setSelectedRouteStops([]);
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to create route');
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: (routeId: string) => deleteRoute(routeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorRoutes'] });
    },
  });

  // Route Builder Helper
  const handleAddStopToRoute = (stopId: string) => {
    if (!stopId) return;
    const seq = selectedRouteStops.length + 1;
    const prev = selectedRouteStops[selectedRouteStops.length - 1];
    setSelectedRouteStops([
      ...selectedRouteStops,
      {
        stopId,
        sequenceNumber: seq,
        distanceFromStartKm: prev ? prev.distanceFromStartKm + 15 : 0,
        estimatedMinutesFromStart: prev ? prev.estimatedMinutesFromStart + 25 : 0,
        fareFromStart: prev ? prev.fareFromStart + 20 : 0,
      },
    ]);
  };

  const handleRemoveStopFromRoute = (index: number) => {
    const updated = selectedRouteStops.filter((_, i) => i !== index);
    setSelectedRouteStops(
      updated.map((s, idx) => ({ ...s, sequenceNumber: idx + 1 }))
    );
  };

  return (
    <div>
      {/* Top Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.lg }}>
        <button
          onClick={() => setActiveTab('ROUTES')}
          style={{
            padding: '8px 18px',
            borderRadius: borderRadius.md,
            backgroundColor: activeTab === 'ROUTES' ? colors.brand.primary : colors.background.secondary,
            color: activeTab === 'ROUTES' ? '#000' : colors.text.secondary,
            border: `1px solid ${activeTab === 'ROUTES' ? colors.brand.primary : colors.border.subtle}`,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          🗺️ Route Corridors ({routesData?.total ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('STOPS')}
          style={{
            padding: '8px 18px',
            borderRadius: borderRadius.md,
            backgroundColor: activeTab === 'STOPS' ? colors.brand.primary : colors.background.secondary,
            color: activeTab === 'STOPS' ? '#000' : colors.text.secondary,
            border: `1px solid ${activeTab === 'STOPS' ? colors.brand.primary : colors.border.subtle}`,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          📍 Geo-Fenced Stops ({stopsData?.total ?? 0})
        </button>
      </div>

      {/* 1. ROUTES TAB */}
      {activeTab === 'ROUTES' && (
        <div
          style={{
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.border.subtle}`,
            padding: spacing.xl,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 'bold', margin: 0 }}>Active Route Corridors</h3>
              <p style={{ fontSize: 12, color: colors.text.secondary, margin: '4px 0 0 0' }}>
                Multi-stop transit corridors with PostGIS LineString geometry and stop sequences.
              </p>
            </div>
            <button
              onClick={() => {
                setActionError(null);
                setShowAddRouteModal(true);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: colors.brand.primary,
                color: '#000',
                fontWeight: 600,
                borderRadius: borderRadius.md,
                border: 'none',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Create Route Corridor
            </button>
          </div>

          {routesLoading ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>
              Loading route corridors...
            </div>
          ) : routesData?.routes.length === 0 ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>
              No route corridors found. Click '+ Create Route Corridor' to design your first route.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border.subtle}`, color: colors.text.secondary }}>
                  <th style={{ padding: '12px 16px' }}>Route Code</th>
                  <th style={{ padding: '12px 16px' }}>Corridor (Origin → Destination)</th>
                  <th style={{ padding: '12px 16px' }}>Stops Count</th>
                  <th style={{ padding: '12px 16px' }}>Distance / Duration</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {routesData?.routes.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${colors.border.subtle}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold', fontFamily: 'monospace', color: colors.brand.primary }}>
                      {r.routeCode}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {r.origin} ➔ {r.destination}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', backgroundColor: colors.background.tertiary, borderRadius: borderRadius.sm, fontSize: 12 }}>
                        {r.stops.length} Stops
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: colors.text.secondary }}>
                      {r.totalDistanceKm} km • {r.estimatedDurationMinutes} mins
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: borderRadius.sm,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: r.isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: r.isActive ? colors.brand.primary : colors.status.error,
                        }}
                      >
                        {r.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => deleteRouteMutation.mutate(r.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          color: colors.status.error,
                          border: `1px solid ${colors.border.subtle}`,
                          borderRadius: borderRadius.sm,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 2. STOPS TAB */}
      {activeTab === 'STOPS' && (
        <div
          style={{
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.border.subtle}`,
            padding: spacing.xl,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 'bold', margin: 0 }}>Geo-Fenced Bus Stops</h3>
              <p style={{ fontSize: 12, color: colors.text.secondary, margin: '4px 0 0 0' }}>
                Spatial boarding locations indexed in PostGIS with coordinate radiuses.
              </p>
            </div>
            <button
              onClick={() => {
                setActionError(null);
                setShowAddStopModal(true);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: colors.brand.primary,
                color: '#000',
                fontWeight: 600,
                borderRadius: borderRadius.md,
                border: 'none',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Add Geo-Fenced Stop
            </button>
          </div>

          {stopsLoading ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>
              Loading stops...
            </div>
          ) : stopsData?.stops.length === 0 ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>
              No stops defined yet. Click '+ Add Geo-Fenced Stop' to create your first stop.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border.subtle}`, color: colors.text.secondary }}>
                  <th style={{ padding: '12px 16px' }}>Stop Code</th>
                  <th style={{ padding: '12px 16px' }}>Stop Name</th>
                  <th style={{ padding: '12px 16px' }}>PostGIS Coordinates</th>
                  <th style={{ padding: '12px 16px' }}>Landmark</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stopsData?.stops.map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${colors.border.subtle}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold', fontFamily: 'monospace', color: colors.brand.primary }}>
                      {s.code}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: colors.text.secondary }}>
                      {s.location.latitude.toFixed(5)}, {s.location.longitude.toFixed(5)}
                    </td>
                    <td style={{ padding: '12px 16px', color: colors.text.tertiary }}>
                      {s.landmark || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => deleteStopMutation.mutate(s.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          color: colors.status.error,
                          border: `1px solid ${colors.border.subtle}`,
                          borderRadius: borderRadius.sm,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 1. Modal: Add Stop */}
      {showAddStopModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: 440, backgroundColor: colors.background.secondary, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}`, padding: spacing.xl }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18 }}>Add Geo-Fenced Bus Stop</h3>
            {actionError && (
              <div style={{ padding: spacing.sm, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${colors.status.error}`, borderRadius: borderRadius.md, color: colors.status.error, fontSize: 12, marginBottom: spacing.md }}>
                {actionError}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createStopMutation.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
            >
              <div>
                <label style={{ fontSize: 12, color: colors.text.secondary }}>Stop Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mandya Main Bus Stand"
                  value={stopName}
                  onChange={(e) => setStopName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.text.secondary }}>Stop Code (Unique)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MNDY-01"
                  value={stopCode}
                  onChange={(e) => setStopCode(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    placeholder="e.g. 12.5230"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    placeholder="e.g. 76.8980"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.text.secondary }}>Landmark (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Opp. Clock Tower"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm }}>
                <button
                  type="button"
                  onClick={() => setShowAddStopModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: colors.background.tertiary, color: colors.text.secondary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStopMutation.isPending}
                  style={{ padding: '8px 18px', backgroundColor: colors.brand.primary, color: '#000', fontWeight: 600, border: 'none', borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  {createStopMutation.isPending ? 'Saving...' : 'Save Stop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Create Route Corridor */}
      {showAddRouteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', backgroundColor: colors.background.secondary, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}`, padding: spacing.xl }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18 }}>Design Route Corridor</h3>
            {actionError && (
              <div style={{ padding: spacing.sm, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${colors.status.error}`, borderRadius: borderRadius.md, color: colors.status.error, fontSize: 12, marginBottom: spacing.md }}>
                {actionError}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedRouteStops.length < 2) {
                  setActionError('A route corridor must have at least 2 stops (Origin and Destination)');
                  return;
                }
                createRouteMutation.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.md }}>
                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Route Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KA-BNG-MYS-01"
                    value={routeCode}
                    onChange={(e) => setRouteCode(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Origin City / Stop</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bangalore Majestic"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Destination City / Stop</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mysore Central"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Stops Sequencer */}
              <div style={{ borderTop: `1px solid ${colors.border.subtle}`, paddingTop: spacing.md }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                  <label style={{ fontSize: 13, fontWeight: 'bold' }}>Sequenced Stops Along Corridor</label>
                  <select
                    onChange={(e) => {
                      handleAddStopToRoute(e.target.value);
                      e.target.value = '';
                    }}
                    defaultValue=""
                    style={{ padding: '6px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 12 }}
                  >
                    <option value="" disabled>+ Add Stop to Sequence...</option>
                    {stopsData?.stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRouteStops.length === 0 ? (
                  <div style={{ padding: spacing.md, backgroundColor: colors.background.tertiary, borderRadius: borderRadius.md, textAlign: 'center', color: colors.text.secondary, fontSize: 12 }}>
                    No stops added. Use the dropdown above to add stops in sequential order.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                    {selectedRouteStops.map((s, idx) => {
                      const stopRec = stopsData?.stops.find((st) => st.id === s.stopId);
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '30px 1fr 100px 100px 90px 30px',
                            gap: spacing.xs,
                            alignItems: 'center',
                            backgroundColor: colors.background.tertiary,
                            padding: '6px 10px',
                            borderRadius: borderRadius.sm,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontWeight: 'bold', color: colors.brand.primary }}>#{s.sequenceNumber}</span>
                          <span style={{ fontWeight: 600 }}>{stopRec?.name || s.stopId}</span>
                          <div>
                            <input
                              type="number"
                              title="Distance from start in km"
                              value={s.distanceFromStartKm}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updated = [...selectedRouteStops];
                                updated[idx].distanceFromStartKm = val;
                                setSelectedRouteStops(updated);
                              }}
                              style={{ width: '100%', padding: '4px', backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.subtle}`, color: colors.text.primary, fontSize: 11, borderRadius: borderRadius.sm }}
                            />
                            <span style={{ fontSize: 9, color: colors.text.tertiary }}>km from start</span>
                          </div>
                          <div>
                            <input
                              type="number"
                              title="Minutes from start"
                              value={s.estimatedMinutesFromStart}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const updated = [...selectedRouteStops];
                                updated[idx].estimatedMinutesFromStart = val;
                                setSelectedRouteStops(updated);
                              }}
                              style={{ width: '100%', padding: '4px', backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.subtle}`, color: colors.text.primary, fontSize: 11, borderRadius: borderRadius.sm }}
                            />
                            <span style={{ fontSize: 9, color: colors.text.tertiary }}>mins from start</span>
                          </div>
                          <div>
                            <input
                              type="number"
                              title="Fare from start in INR"
                              value={s.fareFromStart}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updated = [...selectedRouteStops];
                                updated[idx].fareFromStart = val;
                                setSelectedRouteStops(updated);
                              }}
                              style={{ width: '100%', padding: '4px', backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.subtle}`, color: colors.text.primary, fontSize: 11, borderRadius: borderRadius.sm }}
                            />
                            <span style={{ fontSize: 9, color: colors.text.tertiary }}>₹ from start</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveStopFromRoute(idx)}
                            style={{ background: 'none', border: 'none', color: colors.status.error, cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md }}>
                <button
                  type="button"
                  onClick={() => setShowAddRouteModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: colors.background.tertiary, color: colors.text.secondary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRouteMutation.isPending}
                  style={{ padding: '8px 18px', backgroundColor: colors.brand.primary, color: '#000', fontWeight: 600, border: 'none', borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  {createRouteMutation.isPending ? 'Generating Route...' : 'Create Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

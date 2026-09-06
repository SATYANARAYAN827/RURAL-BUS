import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTrips,
  dispatchTrip,
  updateTripStatus,
  fetchSchedules,
  createSchedule,
  deleteSchedule,
  fetchRoutes,
  fetchBuses,
} from '../services/fleet.api.js';
import { fetchStaffMembers } from '../services/staff.api.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { TripStatus } from '@ruralbus/shared-types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SchedulesView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'TRIPS' | 'SCHEDULES'>('TRIPS');

  // Modal States
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Dispatch Form State
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedBusId, setSelectedBusId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedConductorId, setSelectedConductorId] = useState('');
  const [departureDateTime, setDepartureDateTime] = useState('');
  const [arrivalDateTime, setArrivalDateTime] = useState('');

  // Schedule Form State
  const [scheduleRouteId, setScheduleRouteId] = useState('');
  const [depTime, setDepTime] = useState('08:00');
  const [arrTime, setArrTime] = useState('11:30');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [baseFare, setBaseFare] = useState('80');

  // 1. Queries
  const { data: tripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ['operatorTrips'],
    queryFn: () => fetchTrips(),
  });

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['operatorSchedules'],
    queryFn: () => fetchSchedules(),
  });

  const { data: routesData } = useQuery({
    queryKey: ['operatorRoutes'],
    queryFn: () => fetchRoutes(),
  });

  const { data: busesData } = useQuery({
    queryKey: ['operatorBuses'],
    queryFn: () => fetchBuses({ status: 'ACTIVE' }),
  });

  const { data: driversData } = useQuery({
    queryKey: ['staff', 'DRIVER'],
    queryFn: () => fetchStaffMembers({ role: 'DRIVER' }),
  });

  const { data: conductorsData } = useQuery({
    queryKey: ['staff', 'CONDUCTOR'],
    queryFn: () => fetchStaffMembers({ role: 'CONDUCTOR' }),
  });

  // 2. Mutations
  const dispatchMutation = useMutation({
    mutationFn: () =>
      dispatchTrip({
        routeId: selectedRouteId,
        busId: selectedBusId,
        driverId: selectedDriverId || undefined,
        conductorId: selectedConductorId || undefined,
        departureTime: new Date(departureDateTime).toISOString(),
        scheduledArrival: new Date(arrivalDateTime).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorTrips'] });
      setShowDispatchModal(false);
      setSelectedRouteId('');
      setSelectedBusId('');
      setSelectedDriverId('');
      setSelectedConductorId('');
      setDepartureDateTime('');
      setArrivalDateTime('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to dispatch trip');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ tripId, status }: { tripId: string; status: TripStatus }) =>
      updateTripStatus(tripId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorTrips'] });
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: () =>
      createSchedule({
        routeId: scheduleRouteId,
        departureTime: depTime,
        arrivalTime: arrTime,
        daysOfWeek: selectedDays,
        baseFare: parseFloat(baseFare),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorSchedules'] });
      setShowAddScheduleModal(false);
      setScheduleRouteId('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to create schedule');
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (scheduleId: string) => deleteSchedule(scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorSchedules'] });
    },
  });

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  return (
    <div>
      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.lg }}>
        <button
          onClick={() => setActiveTab('TRIPS')}
          style={{
            padding: '8px 18px',
            borderRadius: borderRadius.md,
            backgroundColor: activeTab === 'TRIPS' ? colors.brand.primary : colors.background.secondary,
            color: activeTab === 'TRIPS' ? '#000' : colors.text.secondary,
            border: `1px solid ${activeTab === 'TRIPS' ? colors.brand.primary : colors.border.subtle}`,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          🚀 Active Dispatched Trips ({tripsData?.total ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('SCHEDULES')}
          style={{
            padding: '8px 18px',
            borderRadius: borderRadius.md,
            backgroundColor: activeTab === 'SCHEDULES' ? colors.brand.primary : colors.background.secondary,
            color: activeTab === 'SCHEDULES' ? '#000' : colors.text.secondary,
            border: `1px solid ${activeTab === 'SCHEDULES' ? colors.brand.primary : colors.border.subtle}`,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ⏱️ Recurring Timetables ({schedulesData?.total ?? 0})
        </button>
      </div>

      {/* 1. TRIPS TAB */}
      {activeTab === 'TRIPS' && (
        <div>
          {/* KPI Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.lg, marginBottom: spacing.xl }}>
            <div style={{ backgroundColor: colors.background.secondary, padding: spacing.lg, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}` }}>
              <div style={{ fontSize: 13, color: colors.text.secondary }}>Scheduled Trips</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: colors.status.info, marginTop: 4 }}>
                {tripsData?.scheduledCount ?? 0}
              </div>
            </div>
            <div style={{ backgroundColor: colors.background.secondary, padding: spacing.lg, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}` }}>
              <div style={{ fontSize: 13, color: colors.text.secondary }}>Live In-Transit</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: colors.brand.primary, marginTop: 4 }}>
                {tripsData?.inTransitCount ?? 0}
              </div>
            </div>
            <div style={{ backgroundColor: colors.background.secondary, padding: spacing.lg, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}` }}>
              <div style={{ fontSize: 13, color: colors.text.secondary }}>Completed Today</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: colors.status.warning, marginTop: 4 }}>
                {tripsData?.completedCount ?? 0}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: colors.background.secondary, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}`, padding: spacing.xl }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 'bold', margin: 0 }}>Dispatched Daily Trip Instances</h3>
                <p style={{ fontSize: 12, color: colors.text.secondary, margin: '4px 0 0 0' }}>
                  Live operational trip manifests assigned to vehicles and crew members.
                </p>
              </div>
              <button
                onClick={() => {
                  setActionError(null);
                  setShowDispatchModal(true);
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
                + Dispatch Daily Trip
              </button>
            </div>

            {tripsLoading ? (
              <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>Loading trips...</div>
            ) : tripsData?.trips.length === 0 ? (
              <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>
                No trips dispatched yet. Click '+ Dispatch Daily Trip' to schedule a trip run.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.border.subtle}`, color: colors.text.secondary }}>
                    <th style={{ padding: '12px 16px' }}>Route</th>
                    <th style={{ padding: '12px 16px' }}>Bus Vehicle</th>
                    <th style={{ padding: '12px 16px' }}>Assigned Crew</th>
                    <th style={{ padding: '12px 16px' }}>Scheduled Timing</th>
                    <th style={{ padding: '12px 16px' }}>Available Seats</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tripsData?.trips.map((t) => (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${colors.border.subtle}` }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <div style={{ color: colors.brand.primary, fontSize: 11, fontFamily: 'monospace' }}>{t.routeCode}</div>
                        {t.origin} ➔ {t.destination}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{t.busRegistrationNumber}</span>
                        <div style={{ fontSize: 11, color: colors.text.tertiary }}>{t.busModel}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12 }}>
                        <div>👨‍✈️ {t.driverName || 'No Driver'}</div>
                        <div style={{ color: colors.text.secondary }}>🎟️ {t.conductorName || 'No Conductor'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: colors.text.secondary }}>
                        <div>Dep: {new Date(t.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div>Arr: {new Date(t.scheduledArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 'bold', color: t.availableSeats > 5 ? colors.brand.primary : colors.status.error }}>
                          {t.availableSeats}
                        </span>
                        <span style={{ color: colors.text.tertiary }}> / {t.totalSeats}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: borderRadius.sm,
                            fontSize: 11,
                            fontWeight: 'bold',
                            backgroundColor:
                              t.status === 'SCHEDULED'
                                ? 'rgba(59, 130, 246, 0.15)'
                                : t.status === 'IN_TRANSIT'
                                ? 'rgba(34, 197, 94, 0.15)'
                                : t.status === 'COMPLETED'
                                ? 'rgba(234, 179, 8, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color:
                              t.status === 'SCHEDULED'
                                ? colors.status.info
                                : t.status === 'IN_TRANSIT'
                                ? colors.brand.primary
                                : t.status === 'COMPLETED'
                                ? colors.status.warning
                                : colors.status.error,
                          }}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {t.status === 'SCHEDULED' && (
                          <button
                            onClick={() => statusMutation.mutate({ tripId: t.id, status: 'CANCELLED' })}
                            style={{ padding: '4px 8px', backgroundColor: 'transparent', color: colors.status.error, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.sm, fontSize: 11, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 2. SCHEDULES TAB */}
      {activeTab === 'SCHEDULES' && (
        <div style={{ backgroundColor: colors.background.secondary, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}`, padding: spacing.xl }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 'bold', margin: 0 }}>Recurring Timetable Templates</h3>
              <p style={{ fontSize: 12, color: colors.text.secondary, margin: '4px 0 0 0' }}>
                Define weekly scheduled departures and base fares for transit corridors.
              </p>
            </div>
            <button
              onClick={() => {
                setActionError(null);
                setShowAddScheduleModal(true);
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
              + Create Timetable Schedule
            </button>
          </div>

          {schedulesLoading ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>Loading timetables...</div>
          ) : schedulesData?.schedules.length === 0 ? (
            <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.text.secondary }}>
              No recurring timetable schedules defined yet. Click '+ Create Timetable Schedule'.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border.subtle}`, color: colors.text.secondary }}>
                  <th style={{ padding: '12px 16px' }}>Route Corridor</th>
                  <th style={{ padding: '12px 16px' }}>Departure Time</th>
                  <th style={{ padding: '12px 16px' }}>Arrival Time</th>
                  <th style={{ padding: '12px 16px' }}>Weekly Run Days</th>
                  <th style={{ padding: '12px 16px' }}>Base Fare</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedulesData?.schedules.map((s) => {
                  const routeRec = routesData?.routes.find((r) => r.id === s.routeId);
                  return (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${colors.border.subtle}` }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <span style={{ color: colors.brand.primary, fontFamily: 'monospace' }}>
                          {routeRec?.routeCode || s.routeId}
                        </span>
                        {routeRec && <div>{routeRec.origin} ➔ {routeRec.destination}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 'bold' }}>{s.departureTime}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{s.arrivalTime}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {DAYS.map((d, idx) => (
                            <span
                              key={d}
                              style={{
                                padding: '2px 5px',
                                borderRadius: borderRadius.sm,
                                fontSize: 10,
                                fontWeight: 'bold',
                                backgroundColor: s.daysOfWeek.includes(idx) ? 'rgba(34, 197, 94, 0.15)' : colors.background.tertiary,
                                color: s.daysOfWeek.includes(idx) ? colors.brand.primary : colors.text.tertiary,
                              }}
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: colors.status.warning }}>₹{s.baseFare}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => deleteScheduleMutation.mutate(s.id)}
                          style={{ padding: '4px 8px', backgroundColor: 'transparent', color: colors.status.error, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.sm, fontSize: 11, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 1. Modal: Dispatch Daily Trip */}
      {showDispatchModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: 520, backgroundColor: colors.background.secondary, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}`, padding: spacing.xl }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18 }}>Dispatch Daily Trip Instance</h3>
            {actionError && (
              <div style={{ padding: spacing.sm, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${colors.status.error}`, borderRadius: borderRadius.md, color: colors.status.error, fontSize: 12, marginBottom: spacing.md }}>
                {actionError}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                dispatchMutation.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
            >
              <div>
                <label style={{ fontSize: 12, color: colors.text.secondary }}>Select Route Corridor</label>
                <select
                  required
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13 }}
                >
                  <option value="">Choose Route...</option>
                  {routesData?.routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeCode} ({r.origin} ➔ {r.destination})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.text.secondary }}>Select Bus Vehicle (Active Fleet)</label>
                <select
                  required
                  value={selectedBusId}
                  onChange={(e) => setSelectedBusId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13 }}
                >
                  <option value="">Choose Bus...</option>
                  {busesData?.buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.registrationNumber} - {b.model} ({b.totalSeats} Seats, {b.seatingType})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Assign Driver</label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13 }}
                  >
                    <option value="">Unassigned</option>
                    {driversData?.staff.map((d) => (
                      <option key={d.userId} value={d.userId}>
                        {d.fullName} ({d.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Assign Conductor</label>
                  <select
                    value={selectedConductorId}
                    onChange={(e) => setSelectedConductorId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13 }}
                  >
                    <option value="">Unassigned</option>
                    {conductorsData?.staff.map((c) => (
                      <option key={c.userId} value={c.userId}>
                        {c.fullName} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Departure Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={departureDateTime}
                    onChange={(e) => setDepartureDateTime(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Scheduled Arrival Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={arrivalDateTime}
                    onChange={(e) => setArrivalDateTime(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm }}>
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: colors.background.tertiary, color: colors.text.secondary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatchMutation.isPending}
                  style={{ padding: '8px 18px', backgroundColor: colors.brand.primary, color: '#000', fontWeight: 600, border: 'none', borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  {dispatchMutation.isPending ? 'Dispatching...' : 'Dispatch Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Create Timetable Schedule */}
      {showAddScheduleModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: 480, backgroundColor: colors.background.secondary, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}`, padding: spacing.xl }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18 }}>Create Timetable Schedule</h3>
            {actionError && (
              <div style={{ padding: spacing.sm, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${colors.status.error}`, borderRadius: borderRadius.md, color: colors.status.error, fontSize: 12, marginBottom: spacing.md }}>
                {actionError}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createScheduleMutation.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
            >
              <div>
                <label style={{ fontSize: 12, color: colors.text.secondary }}>Select Route Corridor</label>
                <select
                  required
                  value={scheduleRouteId}
                  onChange={(e) => setScheduleRouteId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13 }}
                >
                  <option value="">Choose Route...</option>
                  {routesData?.routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeCode} ({r.origin} ➔ {r.destination})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Departure Time (HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={depTime}
                    onChange={(e) => setDepTime(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: colors.text.secondary }}>Arrival Time (HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={arrTime}
                    onChange={(e) => setArrTime(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 6, display: 'block' }}>
                  Weekly Operational Days
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DAYS.map((d, idx) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: borderRadius.sm,
                        backgroundColor: selectedDays.includes(idx) ? colors.brand.primary : colors.background.tertiary,
                        color: selectedDays.includes(idx) ? '#000' : colors.text.secondary,
                        border: `1px solid ${selectedDays.includes(idx) ? colors.brand.primary : colors.border.subtle}`,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.text.secondary }}>Base Fare (₹)</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={baseFare}
                  onChange={(e) => setBaseFare(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm }}>
                <button
                  type="button"
                  onClick={() => setShowAddScheduleModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: colors.background.tertiary, color: colors.text.secondary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createScheduleMutation.isPending}
                  style={{ padding: '8px 18px', backgroundColor: colors.brand.primary, color: '#000', fontWeight: 600, border: 'none', borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  {createScheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

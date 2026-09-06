import { apiClient } from './api.client.js';
import type {
  Bus,
  BusListResponse,
  CreateBusInput,
  UpdateBusInput,
  Stop,
  StopListResponse,
  CreateStopInput,
  UpdateStopInput,
  Route,
  RouteListResponse,
  CreateRouteInput,
  UpdateRouteInput,
  Schedule,
  ScheduleListResponse,
  CreateScheduleInput,
  UpdateScheduleInput,
  Trip,
  TripWithDetails,
  TripListResponse,
  DispatchTripInput,
  TripStatus,
} from '@ruralbus/shared-types';

// ==========================================
// 1. Bus Fleet API
// ==========================================

export interface OperatorItem {
  id: string;
  companyName: string;
  businessCode: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
}

export async function fetchOperators(): Promise<OperatorItem[]> {
  const res = await apiClient.get<{ success: boolean; data: { operators: OperatorItem[] } }>(
    '/api/v1/tenant/operators'
  );
  return res.data.data.operators;
}

export async function fetchBuses(params?: { status?: string; search?: string; tenantId?: string }): Promise<BusListResponse> {
  const res = await apiClient.get<{ success: boolean; data: BusListResponse }>(
    '/api/v1/operator/buses',
    { params }
  );
  return res.data.data;
}

export async function createBus(input: CreateBusInput): Promise<Bus> {
  const res = await apiClient.post<{ success: boolean; data: { bus: Bus } }>(
    '/api/v1/operator/buses',
    input
  );
  return res.data.data.bus;
}

export async function updateBus(busId: string, input: UpdateBusInput): Promise<Bus> {
  const res = await apiClient.put<{ success: boolean; data: { bus: Bus } }>(
    `/api/v1/operator/buses/${busId}`,
    input
  );
  return res.data.data.bus;
}

export async function deleteBus(busId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.delete<{ success: boolean; data: { success: boolean; message: string } }>(
    `/api/v1/operator/buses/${busId}`
  );
  return res.data.data;
}

// ==========================================
// 2. Stops API
// ==========================================

export async function fetchStops(params?: { search?: string }): Promise<StopListResponse> {
  const res = await apiClient.get<{ success: boolean; data: StopListResponse }>(
    '/api/v1/operator/stops',
    { params }
  );
  return res.data.data;
}

export async function createStop(input: CreateStopInput): Promise<Stop> {
  const res = await apiClient.post<{ success: boolean; data: { stop: Stop } }>(
    '/api/v1/operator/stops',
    input
  );
  return res.data.data.stop;
}

export async function updateStop(stopId: string, input: UpdateStopInput): Promise<Stop> {
  const res = await apiClient.put<{ success: boolean; data: { stop: Stop } }>(
    `/api/v1/operator/stops/${stopId}`,
    input
  );
  return res.data.data.stop;
}

export async function deleteStop(stopId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.delete<{ success: boolean; data: { success: boolean; message: string } }>(
    `/api/v1/operator/stops/${stopId}`
  );
  return res.data.data;
}

// ==========================================
// 3. Routes API
// ==========================================

export async function fetchRoutes(params?: { search?: string; isActive?: boolean }): Promise<RouteListResponse> {
  const res = await apiClient.get<{ success: boolean; data: RouteListResponse }>(
    '/api/v1/operator/routes',
    { params }
  );
  return res.data.data;
}

export async function fetchRouteById(routeId: string): Promise<Route> {
  const res = await apiClient.get<{ success: boolean; data: { route: Route } }>(
    `/api/v1/operator/routes/${routeId}`
  );
  return res.data.data.route;
}

export async function createRoute(input: CreateRouteInput): Promise<Route> {
  const res = await apiClient.post<{ success: boolean; data: { route: Route } }>(
    '/api/v1/operator/routes',
    input
  );
  return res.data.data.route;
}

export async function updateRoute(routeId: string, input: UpdateRouteInput): Promise<Route> {
  const res = await apiClient.put<{ success: boolean; data: { route: Route } }>(
    `/api/v1/operator/routes/${routeId}`,
    input
  );
  return res.data.data.route;
}

export async function deleteRoute(routeId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.delete<{ success: boolean; data: { success: boolean; message: string } }>(
    `/api/v1/operator/routes/${routeId}`
  );
  return res.data.data;
}

// ==========================================
// 4. Schedules API
// ==========================================

export async function fetchSchedules(params?: { routeId?: string }): Promise<ScheduleListResponse> {
  const res = await apiClient.get<{ success: boolean; data: ScheduleListResponse }>(
    '/api/v1/operator/schedules',
    { params }
  );
  return res.data.data;
}

export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
  const res = await apiClient.post<{ success: boolean; data: { schedule: Schedule } }>(
    '/api/v1/operator/schedules',
    input
  );
  return res.data.data.schedule;
}

export async function updateSchedule(scheduleId: string, input: UpdateScheduleInput): Promise<Schedule> {
  const res = await apiClient.put<{ success: boolean; data: { schedule: Schedule } }>(
    `/api/v1/operator/schedules/${scheduleId}`,
    input
  );
  return res.data.data.schedule;
}

export async function deleteSchedule(scheduleId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.delete<{ success: boolean; data: { success: boolean; message: string } }>(
    `/api/v1/operator/schedules/${scheduleId}`
  );
  return res.data.data;
}

// ==========================================
// 5. Trips API
// ==========================================

export async function fetchTrips(params?: { routeId?: string; busId?: string; status?: TripStatus }): Promise<TripListResponse> {
  const res = await apiClient.get<{ success: boolean; data: TripListResponse }>(
    '/api/v1/operator/trips',
    { params }
  );
  return res.data.data;
}

export async function dispatchTrip(input: DispatchTripInput): Promise<TripWithDetails> {
  const res = await apiClient.post<{ success: boolean; data: { trip: TripWithDetails } }>(
    '/api/v1/operator/trips/dispatch',
    input
  );
  return res.data.data.trip;
}

export async function updateTripStatus(tripId: string, status: TripStatus): Promise<Trip> {
  const res = await apiClient.put<{ success: boolean; data: { trip: Trip } }>(
    `/api/v1/operator/trips/${tripId}/status`,
    { status }
  );
  return res.data.data.trip;
}

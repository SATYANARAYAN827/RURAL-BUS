import axios from 'axios';
import { useAuthStore } from '../stores/auth.store.js';
import type {
  GpsPingPayload,
  LiveTripLocation,
} from '@ruralbus/shared-types';

const API_URL =
  (typeof process !== 'undefined' && process.env?.API_URL) || 'http://localhost:4000';

export class MobileTelemetryClient {
  private static instance: MobileTelemetryClient;
  private pendingPings: GpsPingPayload[] = [];
  private isStreaming = false;
  private timer: any = null;

  static getInstance(): MobileTelemetryClient {
    if (!this.instance) {
      this.instance = new MobileTelemetryClient();
    }
    return this.instance;
  }

  /**
   * Driver sends a single GPS ping to the backend.
   */
  async sendGpsPing(payload: GpsPingPayload): Promise<boolean> {
    try {
      const token = useAuthStore.getState().tokens?.accessToken;
      await axios.post(
        `${API_URL}/api/v1/tracking/ping`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 4000,
        }
      );
      return true;
    } catch (err: any) {
      if (err?.response?.status >= 400 && err?.response?.status < 500) {
        // Stop driver stream and do not buffer invalid payloads
        this.stopDriverStream();
        return false;
      }
      // Buffer in memory only if offline or network error
      this.pendingPings.push(payload);
      if (this.pendingPings.length > 50) this.pendingPings.shift();
      return false;
    }
  }

  /**
   * Passenger fetches live GPS location for a specific trip.
   */
  async getTripLiveLocation(tripId: string): Promise<LiveTripLocation | null> {
    try {
      const token = useAuthStore.getState().tokens?.accessToken;
      const res = await axios.get(`${API_URL}/api/v1/tracking/trip/${tripId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 4000,
      });
      return res.data?.data?.location ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Starts periodic driver GPS streaming simulation (every 3 seconds).
   */
  startDriverStream(tripId: string, getCoords: () => { latitude: number; longitude: number; speed?: number; heading?: number }): void {
    if (this.isStreaming) return;
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!tripId || !UUID_REGEX.test(tripId)) return;

    this.isStreaming = true;

    this.timer = setInterval(async () => {
      if (!this.isStreaming) return;
      const coords = getCoords();
      if (
        !coords ||
        typeof coords.latitude !== 'number' ||
        isNaN(coords.latitude) ||
        coords.latitude < -90 ||
        coords.latitude > 90 ||
        typeof coords.longitude !== 'number' ||
        isNaN(coords.longitude) ||
        coords.longitude < -180 ||
        coords.longitude > 180
      ) {
        return;
      }

      await this.sendGpsPing({
        tripId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        // Omit speed/heading when the device does not provide valid values;
        // the API schema defaults missing fields to 0, avoiding fake data.
        ...(typeof coords.speed === 'number' && coords.speed >= 0 ? { speed: coords.speed } : {}),
        ...(typeof coords.heading === 'number' && coords.heading >= 0 && coords.heading <= 360 ? { heading: coords.heading } : {}),
        timestamp: Date.now(),
      });
    }, 3000);
  }

  stopDriverStream(): void {
    this.isStreaming = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const telemetryClient = MobileTelemetryClient.getInstance();

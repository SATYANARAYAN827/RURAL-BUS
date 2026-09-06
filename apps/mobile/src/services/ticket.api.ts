import axios from 'axios';
import { useAuthStore } from '../stores/auth.store.js';
import type {
  DigitalTicketPayload,
  TicketValidationResponse,
  OfflineManifestSyncResponse,
} from '@ruralbus/shared-types';

const API_URL = 'http://localhost:4000';

function getAuthHeader() {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchTicketDetailApi(ticketId: string): Promise<DigitalTicketPayload> {
  const res = await axios.get(`${API_URL}/api/v1/tickets/${ticketId}`, {
    headers: getAuthHeader(),
  });
  return res.data.data;
}

export async function validateTicketQrApi(qrData: string): Promise<TicketValidationResponse> {
  const res = await axios.post(
    `${API_URL}/api/v1/tickets/validate-qr`,
    { qrData },
    { headers: getAuthHeader() }
  );
  return res.data.data;
}

export async function fetchOfflineManifestApi(tripId: string): Promise<OfflineManifestSyncResponse> {
  const res = await axios.get(`${API_URL}/api/v1/tickets/manifest/offline/${tripId}`, {
    headers: getAuthHeader(),
  });
  return res.data.data;
}

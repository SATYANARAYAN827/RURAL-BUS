import axios from 'axios';
import { useAuthStore } from '../stores/auth.store.js';
import type {
  OfflineCashTicketBatchSyncRequest,
  OfflineCashTicketBatchSyncResponse,
  ConductorCashSettlementReport,
} from '@ruralbus/shared-types';

const API_URL = 'http://localhost:4000';

function getAuthHeader() {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function syncOfflineCashTicketsApi(
  req: OfflineCashTicketBatchSyncRequest
): Promise<OfflineCashTicketBatchSyncResponse> {
  const res = await axios.post(
    `${API_URL}/api/v1/conductor/offline-tickets/sync`,
    req,
    { headers: getAuthHeader() }
  );
  return res.data.data;
}

export async function fetchCashSettlementReportApi(
  tripId: string
): Promise<ConductorCashSettlementReport> {
  const res = await axios.get(
    `${API_URL}/api/v1/conductor/cash-settlement/${tripId}`,
    { headers: getAuthHeader() }
  );
  return res.data.data;
}

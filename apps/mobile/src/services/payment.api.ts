import axios from 'axios';
import { useAuthStore } from '../stores/auth.store.js';
import type {
  PaymentOrderResponse,
  PaymentVerificationRequest,
  PaymentVerificationResponse,
} from '@ruralbus/shared-types';

const API_URL = 'http://localhost:4000';

function getAuthHeader() {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function createPaymentOrderApi(bookingId: string): Promise<PaymentOrderResponse> {
  const res = await axios.post(
    `${API_URL}/api/v1/payments/create-order`,
    { bookingId },
    { headers: getAuthHeader() }
  );
  return res.data.data;
}

export async function verifyPaymentApi(req: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
  const res = await axios.post(
    `${API_URL}/api/v1/payments/verify`,
    req,
    { headers: getAuthHeader() }
  );
  return res.data.data;
}

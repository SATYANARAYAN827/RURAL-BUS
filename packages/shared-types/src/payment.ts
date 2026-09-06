export interface PaymentOrderRequest {
  bookingId: string;
}

export interface PaymentOrderResponse {
  orderId: string;
  amountInPaise: number;
  currency: string;
  bookingId: string;
  keyId: string;
}

export interface PaymentVerificationRequest {
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface PaymentVerificationResponse {
  success: boolean;
  bookingId: string;
  ticketId: string;
  status: 'CONFIRMED';
  qrSignature: string;
}

export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        notes?: Record<string, string>;
      };
    };
  };
}

export type NotificationChannel = 'PUSH' | 'SMS' | 'IN_APP';
export type NotificationType = 'TRIP_UPDATE' | 'BOOKING_CONFIRMED' | 'DELAY_ALERT' | 'GATE_ANNOUNCEMENT' | 'EMERGENCY_BROADCAST';

export interface NotificationPayload {
  notificationId: string;
  recipientUserId?: string;
  recipientPhone?: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  metadata?: Record<string, any>;
  sentAt: string;
}

export interface SendNotificationRequest {
  tripId?: string;
  recipientUserId?: string;
  type: NotificationType;
  title: string;
  body: string;
  channel?: NotificationChannel;
}

export interface SendNotificationResponse {
  delivered: boolean;
  notificationId: string;
  channel: NotificationChannel;
  timestamp: string;
}

export interface ThermalReceiptPayload {
  ticketCode: string;
  operatorName: string;
  busNumber: string;
  routeTitle: string;
  fromStop: string;
  toStop: string;
  seatNumber: number | string;
  fare: number;
  paymentMode: 'ONLINE' | 'CASH';
  issuedAt: string;
  escPosRawText: string;
}

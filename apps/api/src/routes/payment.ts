import { FastifyInstance } from 'fastify';
import { requireRole } from '../plugins/rbac.js';
import {
  createPaymentOrder,
  verifyPayment,
  processRazorpayWebhook,
} from '../services/payment.service.js';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
} from '@ruralbus/shared-validators';

export async function paymentRoutes(app: FastifyInstance) {
  // Create Payment Order (Passenger)
  app.post(
    '/api/v1/payments/create-order',
    {
      onRequest: [app.authenticate, requireRole(['PASSENGER'])],
    },
    async (request, reply) => {
      const passengerId = request.user!.sub;
      const { bookingId } = createPaymentOrderSchema.parse(request.body);

      const order = await createPaymentOrder(passengerId, bookingId);
      return reply.code(200).send({
        success: true,
        data: order,
      });
    }
  );

  // Verify Payment & Issue Digital Ticket (Passenger)
  app.post(
    '/api/v1/payments/verify',
    {
      onRequest: [app.authenticate, requireRole(['PASSENGER'])],
    },
    async (request, reply) => {
      const passengerId = request.user!.sub;
      const input = verifyPaymentSchema.parse(request.body);

      const result = await verifyPayment(passengerId, input);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    }
  );

  // Razorpay Webhook Ingress (Public with signature verification)
  app.post('/api/v1/payments/webhook', async (request, reply) => {
    const signature = request.headers['x-razorpay-signature'] as string | undefined;
    const rawBody = JSON.stringify(request.body);

    const result = await processRazorpayWebhook(rawBody, signature);
    return reply.code(200).send({
      success: true,
      data: result,
    });
  });
}

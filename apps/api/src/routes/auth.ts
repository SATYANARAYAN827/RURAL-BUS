import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  registerPassengerSchema,
  loginSchema,
  refreshTokenSchema,
  requestOtpSchema,
  verifyOtpSchema,
  resetPasswordWithOtpSchema,
  forceChangePasswordSchema,
} from '@ruralbus/shared-validators';
import {
  registerPassenger,
  login,
  refreshTokens,
  logout,
  getProfile,
  resetPasswordWithToken,
  forceChangePassword,
} from '../services/auth.service.js';
import { requestOtp, verifyOtp } from '../services/otp.service.js';

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. Passenger Self-Registration
  app.post(
    '/api/v1/auth/register',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedBody = registerPassengerSchema.parse(request.body);

      const result = await registerPassenger(parsedBody, (payload) =>
        app.jwt.sign(payload)
      );

      // Set HTTP-only cookie if cookie plugin is active
      if (reply.setCookie) {
        reply.setCookie('refreshToken', result.tokens.refreshToken, {
          path: '/api/v1/auth',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 3600,
        });
      }

      return reply.status(201).send({
        success: true,
        data: result,
      });
    }
  );

  // 2. User Authentication (Email/Phone + Password)
  app.post(
    '/api/v1/auth/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedBody = loginSchema.parse(request.body);

      const result = await login(parsedBody, (payload) =>
        app.jwt.sign(payload)
      );

      if (reply.setCookie) {
        reply.setCookie('refreshToken', result.tokens.refreshToken, {
          path: '/api/v1/auth',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 3600,
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // 3. Token Rotation (Refresh Token Exchange)
  app.post(
    '/api/v1/auth/refresh',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = (request.body as { refreshToken?: string }) || {};
      const tokenFromCookie = (request.cookies as Record<string, string>)?.refreshToken;
      const refreshToken = body.refreshToken || tokenFromCookie;

      const parsed = refreshTokenSchema.parse({ refreshToken });

      const result = await refreshTokens(parsed, (payload) =>
        app.jwt.sign(payload)
      );

      if (reply.setCookie) {
        reply.setCookie('refreshToken', result.tokens.refreshToken, {
          path: '/api/v1/auth',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 3600,
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  // 4. Session Revocation / Logout
  app.post(
    '/api/v1/auth/logout',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = (request.body as { refreshToken?: string }) || {};
      const tokenFromCookie = (request.cookies as Record<string, string>)?.refreshToken;
      const refreshToken = body.refreshToken || tokenFromCookie;

      await logout(refreshToken);

      if (reply.clearCookie) {
        reply.clearCookie('refreshToken', { path: '/api/v1/auth' });
      }

      return reply.status(200).send({
        success: true,
        message: 'Logged out successfully',
      });
    }
  );

  // 5. Authenticated User Profile
  app.get(
    '/api/v1/auth/me',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const profile = await getProfile(request.user.sub);
      return reply.status(200).send({
        success: true,
        data: {
          user: profile,
        },
      });
    }
  );

  // 6. Request OTP (5-minute expiry for password reset / first verification)
  app.post(
    '/api/v1/auth/otp/request',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedBody = requestOtpSchema.parse(request.body);
      const result = await requestOtp(parsedBody);
      return reply.status(200).send(result);
    }
  );

  // 7. Verify OTP (Max 5 attempts)
  app.post(
    '/api/v1/auth/otp/verify',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedBody = verifyOtpSchema.parse(request.body);
      const result = await verifyOtp(parsedBody);
      return reply.status(200).send(result);
    }
  );

  // 8. Password Reset with Verified Token
  app.post(
    '/api/v1/auth/password-reset',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedBody = resetPasswordWithOtpSchema.parse(request.body);
      const result = await resetPasswordWithToken(parsedBody);
      return reply.status(200).send(result);
    }
  );

  // 9. Force Change Password (for must_change_password authenticated users)
  app.post(
    '/api/v1/auth/force-change-password',
    {
      preHandler: [app.authenticate],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedBody = forceChangePasswordSchema.parse(request.body);
      const result = await forceChangePassword(
        request.user.sub,
        parsedBody,
        (payload) => app.jwt.sign(payload)
      );

      if (reply.setCookie) {
        reply.setCookie('refreshToken', result.tokens.refreshToken, {
          path: '/api/v1/auth',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 3600,
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );
};


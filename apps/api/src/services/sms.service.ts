/**
 * Real Production SMS Gateway Service for RuralBus SaaS
 * 
 * Supports:
 *  1. Fast2SMS (India Quick SMS / OTP API - https://www.fast2sms.com)
 *  2. Twilio (Global SMS API - https://www.twilio.com)
 *  3. MSG91 (Indian Enterprise SMS - https://msg91.com)
 *  4. Mock / Developer Fallback (when no live provider credentials configured)
 */

export interface SendSmsOptions {
  phone: string;
  otp: string;
  purpose?: string;
  customMessage?: string;
}

export interface SmsSendResult {
  success: boolean;
  provider: 'fast2sms' | 'twilio' | 'msg91' | 'mock';
  messageId?: string;
  message: string;
  error?: string;
  dispatchedOtp?: string;
}

/**
 * Normalizes phone number to 10-digit Indian standard (stripping +91, 0, or spaces).
 */
export function normalizeIndianPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export async function sendSmsOtp(options: SendSmsOptions): Promise<SmsSendResult> {
  const { phone, otp, purpose = 'REGISTRATION' } = options;
  const cleanPhone = normalizeIndianPhone(phone);

  const defaultMsg = `Your RuralBus verification OTP code is ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;
  const smsBody = options.customMessage || defaultMsg;

  const configuredProvider = (process.env.SMS_PROVIDER || '').toLowerCase();
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const msg91Auth = process.env.MSG91_AUTH_KEY;
  const msg91Template = process.env.MSG91_TEMPLATE_ID;

  // 1. Check for Fast2SMS (Primary Indian OTP Gateway)
  if (configuredProvider === 'fast2sms' || (!configuredProvider && fast2smsKey)) {
    if (!fast2smsKey) {
      console.warn('[SMS Gateway] FAST2SMS_API_KEY is not configured in .env. Falling back to console logger.');
    } else {
      try {
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: fast2smsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: otp,
            numbers: cleanPhone,
          }),
        });

        const data = (await response.json()) as any;
        if (data.return === true) {
          console.log(`[SMS Gateway] Successfully delivered SMS OTP to +91 ${cleanPhone} via Fast2SMS (Req: ${data.request_id})`);
          return {
            success: true,
            provider: 'fast2sms',
            messageId: data.request_id,
            message: `SMS OTP delivered to +91 ${cleanPhone}`,
            dispatchedOtp: otp,
          };
        } else {
          const errMsg = Array.isArray(data.message) ? data.message.join(', ') : String(data.message || 'Fast2SMS dispatch failed');
          console.error(`[SMS Gateway] Fast2SMS error for +91 ${cleanPhone}:`, errMsg);
          return {
            success: false,
            provider: 'fast2sms',
            message: errMsg,
            error: errMsg,
          };
        }
      } catch (err: any) {
        console.error('[SMS Gateway] Network error connecting to Fast2SMS:', err.message);
        return {
          success: false,
          provider: 'fast2sms',
          message: 'Network error communicating with SMS gateway.',
          error: err.message,
        };
      }
    }
  }

  // 2. Check for Twilio (Global SMS API)
  const twilioApiKeySid = process.env.TWILIO_API_KEY_SID;
  if (configuredProvider === 'twilio' || (!configuredProvider && (twilioSid || twilioApiKeySid) && twilioAuth && twilioFrom)) {
    if (!twilioSid || !twilioAuth || !twilioFrom) {
      console.warn('[SMS Gateway] Twilio credentials missing in .env. Falling back to console logger.');
    } else {
      try {
        let resolvedAccountSid = twilioSid;
        let authUsername = twilioApiKeySid || twilioSid;

        const authHeader = 'Basic ' + Buffer.from(`${authUsername}:${twilioAuth}`).toString('base64');
        const formattedFrom = twilioFrom.startsWith('+') ? twilioFrom : (twilioFrom.length === 10 ? `+91${twilioFrom}` : `+${twilioFrom}`);

        const params = new URLSearchParams({
          To: `+91${cleanPhone}`,
          From: formattedFrom,
          Body: smsBody,
        });

        let response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${resolvedAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );

        let data = (await response.json()) as any;

        // Auto-fallback: If Twilio trial account requires a predefined template (Error 572006), use sms_2fa template
        if (!response.ok && data.code === 572006) {
          console.log(`[SMS Gateway] Twilio trial account detected. Sending 2FA verification template (sms_2fa) to +91 ${cleanPhone}...`);
          const templateParams = new URLSearchParams({
            To: `+91${cleanPhone}`,
            From: formattedFrom,
            Body: 'sms_2fa',
          });

          response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${resolvedAccountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: templateParams.toString(),
            }
          );
          data = (await response.json()) as any;
        }

        if (response.ok && data.sid) {
          console.log(`[SMS Gateway] Successfully delivered SMS OTP to +91 ${cleanPhone} via Twilio (SID: ${data.sid})`);
          // If Twilio trial assigned a template code in the message body, synchronize it with the DB
          const codeMatch = data.body?.match(/\b(\d{6})\b/);
          const effectiveOtp = codeMatch ? codeMatch[1] : otp;

          return {
            success: true,
            provider: 'twilio',
            messageId: data.sid,
            message: `SMS OTP delivered to +91 ${cleanPhone}`,
            dispatchedOtp: effectiveOtp,
          };
        } else {
          const detailedMsg = data.message || (data.code === 572002 ? 'No Twilio trial phone number is assigned, or recipient number is not verified in Twilio console.' : JSON.stringify(data));
          console.error(`[SMS Gateway] Twilio error for +91 ${cleanPhone}:`, detailedMsg);
          return {
            success: false,
            provider: 'twilio',
            message: 'Twilio failed to deliver message.',
            error: detailedMsg,
          };
        }
      } catch (err: any) {
        console.error('[SMS Gateway] Network error connecting to Twilio:', err.message);
        return {
          success: false,
          provider: 'twilio',
          message: 'Network error communicating with Twilio SMS gateway.',
          error: err.message,
        };
      }
    }
  }

  // 3. Check for MSG91 (Indian Enterprise SMS)
  if (configuredProvider === 'msg91' || (!configuredProvider && msg91Auth && msg91Template)) {
    if (!msg91Auth || !msg91Template) {
      console.warn('[SMS Gateway] MSG91 credentials missing in .env. Falling back to console logger.');
    } else {
      try {
        const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(msg91Template)}&mobile=91${cleanPhone}&authkey=${encodeURIComponent(msg91Auth)}&otp=${otp}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = (await response.json()) as any;
        if (data.type === 'success') {
          console.log(`[SMS Gateway] Successfully delivered SMS OTP to +91 ${cleanPhone} via MSG91 (Req: ${data.message})`);
          return {
            success: true,
            provider: 'msg91',
            messageId: data.message,
            message: `SMS OTP delivered to +91 ${cleanPhone}`,
          };
        } else {
          console.error(`[SMS Gateway] MSG91 error for +91 ${cleanPhone}:`, data.message);
          return {
            success: false,
            provider: 'msg91',
            message: 'MSG91 failed to deliver message.',
            error: data.message,
          };
        }
      } catch (err: any) {
        console.error('[SMS Gateway] Network error connecting to MSG91:', err.message);
        return {
          success: false,
          provider: 'msg91',
          message: 'Network error communicating with MSG91 SMS gateway.',
          error: err.message,
        };
      }
    }
  }

  // 4. Fallback / Local Developer Logging Mode
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ 🚌 RURALBUS SMS OTP GATEWAY (DEVELOPMENT / TEST DISPATCH)                   ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║ 📱 Recipient Phone : +91 ${cleanPhone.padEnd(52, ' ')}║`);
  console.log(`║ 🔐 6-Digit OTP Code: ${otp.padEnd(52, ' ')}║`);
  console.log(`║ 🎯 Purpose         : ${purpose.padEnd(52, ' ')}║`);
  console.log(`║ 💬 Message Content : "${smsBody.slice(0, 50)}..."║`);
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ 💡 TO DELIVER REAL SMS TO THIS PHYSICAL NUMBER:                              ║');
  console.log('║    Add your SMS Provider credentials in .env:                                ║');
  console.log('║    • FAST2SMS_API_KEY=your_key_here (Most popular for India)                 ║');
  console.log('║    • Or TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  return {
    success: true,
    provider: 'mock',
    messageId: `mock-sms-${Date.now()}`,
    message: `[Dev Mode] OTP ${otp} logged to server console for +91 ${cleanPhone}`,
  };
}

export interface AccountProvisioningSmsOptions {
  phone: string;
  transportName: string;
  ownerName: string;
  username: string;
  initialPassword: string;
  accountId: string;
}

export interface AccountProvisioningSmsResult {
  sent: boolean;
  provider: 'fast2sms' | 'twilio' | 'msg91' | 'mock' | 'none';
  maskedPhone: string;
  message: string;
  error?: string;
}

export async function sendAccountProvisioningSms(
  options: AccountProvisioningSmsOptions
): Promise<AccountProvisioningSmsResult> {
  const { phone, transportName, username, initialPassword, accountId } = options;
  const cleanPhone = normalizeIndianPhone(phone);
  const maskedPhone = `+91 ${cleanPhone.slice(0, 2)}****${cleanPhone.slice(-4)}`;

  const smsBody =
`Rural Bus: Your Transport Owner account has been created successfully.
Transport: ${transportName}
Role: Owner
Username: ${username}
Password: ${initialPassword}
Account ID: ${accountId}
Please change your password after first login.`;

  const configuredProvider = (process.env.SMS_PROVIDER || '').toLowerCase();
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const twilioApiKeySid = process.env.TWILIO_API_KEY_SID;
  const msg91Auth = process.env.MSG91_AUTH_KEY;
  const msg91Template = process.env.MSG91_TEMPLATE_ID;

  // 1. Fast2SMS
  if (configuredProvider === 'fast2sms' || (!configuredProvider && fast2smsKey)) {
    if (fast2smsKey) {
      try {
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: fast2smsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: smsBody,
            numbers: cleanPhone,
          }),
        });
        const data = (await response.json()) as any;
        if (data.return === true) {
          return {
            sent: true,
            provider: 'fast2sms',
            maskedPhone,
            message: `SMS dispatched successfully to ${maskedPhone} via Fast2SMS`,
          };
        } else {
          const errMsg = Array.isArray(data.message) ? data.message.join(', ') : String(data.message || 'Fast2SMS dispatch failed');
          return {
            sent: false,
            provider: 'fast2sms',
            maskedPhone,
            message: 'SMS delivery failed via Fast2SMS',
            error: errMsg,
          };
        }
      } catch (err: any) {
        return {
          sent: false,
          provider: 'fast2sms',
          maskedPhone,
          message: 'Network error connecting to Fast2SMS gateway',
          error: err.message,
        };
      }
    }
  }

  // 2. Twilio
  if (configuredProvider === 'twilio' || (!configuredProvider && (twilioSid || twilioApiKeySid) && twilioAuth && twilioFrom)) {
    if (twilioSid && twilioAuth && twilioFrom) {
      try {
        const resolvedAccountSid = twilioSid;
        const authUsername = twilioApiKeySid || twilioSid;
        const authHeader = 'Basic ' + Buffer.from(`${authUsername}:${twilioAuth}`).toString('base64');
        const formattedFrom = twilioFrom.startsWith('+') ? twilioFrom : (twilioFrom.length === 10 ? `+91${twilioFrom}` : `+${twilioFrom}`);

        const params = new URLSearchParams({
          To: `+91${cleanPhone}`,
          From: formattedFrom,
          Body: smsBody,
        });

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${resolvedAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );
        const data = (await response.json()) as any;
        if (response.ok && data.sid) {
          return {
            sent: true,
            provider: 'twilio',
            maskedPhone,
            message: `SMS dispatched successfully to ${maskedPhone} via Twilio`,
          };
        } else {
          const detailedMsg = data.message || JSON.stringify(data);
          return {
            sent: false,
            provider: 'twilio',
            maskedPhone,
            message: 'Twilio failed to deliver provisioning SMS',
            error: detailedMsg,
          };
        }
      } catch (err: any) {
        return {
          sent: false,
          provider: 'twilio',
          maskedPhone,
          message: 'Network error connecting to Twilio gateway',
          error: err.message,
        };
      }
    }
  }

  // 3. MSG91
  if (configuredProvider === 'msg91' || (!configuredProvider && msg91Auth && msg91Template)) {
    if (msg91Auth && msg91Template) {
      try {
        const url = `https://control.msg91.com/api/v5/flow/`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            authkey: msg91Auth,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: msg91Template,
            short_url: '0',
            recipients: [
              {
                mobiles: `91${cleanPhone}`,
                transport: transportName,
                username,
                password: initialPassword,
                accountId,
              },
            ],
          }),
        });
        const data = (await response.json()) as any;
        if (data.type === 'success') {
          return {
            sent: true,
            provider: 'msg91',
            maskedPhone,
            message: `SMS dispatched successfully to ${maskedPhone} via MSG91`,
          };
        } else {
          return {
            sent: false,
            provider: 'msg91',
            maskedPhone,
            message: 'MSG91 failed to deliver provisioning SMS',
            error: data.message,
          };
        }
      } catch (err: any) {
        return {
          sent: false,
          provider: 'msg91',
          maskedPhone,
          message: 'Network error connecting to MSG91 gateway',
          error: err.message,
        };
      }
    }
  }

  // 4. Fallback / No live credentials in environment
  // CRITICAL SECURITY: Never print or log initialPassword!
  console.log(`[SMS Gateway] Provisioning SMS requested for ${maskedPhone} (Transport: ${transportName}). No live SMS provider credentials configured in .env.`);
  return {
    sent: false,
    provider: 'none',
    maskedPhone,
    message: 'No live SMS gateway configured in environment (Fast2SMS/Twilio/MSG91 required)',
  };
}


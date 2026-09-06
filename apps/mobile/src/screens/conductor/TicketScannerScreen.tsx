import React, { useState } from 'react';
import { validateTicketQrApi } from '../../services/ticket.api.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { TicketValidationResponse } from '@ruralbus/shared-types';

export function TicketScannerScreen() {
  const [qrInput, setQrInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<TicketValidationResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!qrInput.trim()) return;
    setValidating(true);
    setErrorMsg(null);

    try {
      const res = await validateTicketQrApi(qrInput.trim());
      setResult(res);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Invalid QR code or network error';
      setErrorMsg(msg);
      setResult(null);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary }}>
      <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 4px 0' }}>Conductor QR Scanner</h1>
      <p style={{ fontSize: 13, color: colors.text.secondary, margin: '0 0 16px 0' }}>
        Instant ticket validation & duplicate boarding scan defense
      </p>

      {/* Simulated Scanner Viewport */}
      <div
        style={{
          height: 200,
          backgroundColor: colors.background.tertiary,
          borderRadius: borderRadius.lg,
          border: `2px dashed ${colors.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <div style={{ fontSize: 40 }}>📷</div>
        <div style={{ fontSize: 13, color: colors.text.secondary, marginTop: 8 }}>
          Point camera at passenger digital QR code
        </div>
      </div>

      {/* QR Payload Input / Paste Field */}
      <div style={{ marginBottom: spacing.md }}>
        <input
          type="text"
          value={qrInput}
          onChange={(e) => setQrInput(e.target.value)}
          placeholder="Paste or scan TKT-QR token..."
          style={{
            width: '100%',
            padding: spacing.md,
            backgroundColor: colors.background.secondary,
            border: `1px solid ${colors.border.subtle}`,
            borderRadius: borderRadius.md,
            color: colors.text.primary,
            fontSize: 13,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        disabled={validating || !qrInput.trim()}
        onClick={handleValidate}
        style={{
          width: '100%',
          padding: '12px 16px',
          backgroundColor: colors.brand.primary,
          color: '#ffffff',
          fontWeight: 600,
          fontSize: 14,
          border: 'none',
          borderRadius: borderRadius.md,
          cursor: validating || !qrInput.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {validating ? 'Verifying Signature...' : 'Validate & Board Passenger →'}
      </button>

      {/* Validation Result HUD */}
      {result && result.valid && (
        <div
          style={{
            marginTop: spacing.lg,
            padding: spacing.lg,
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            borderRadius: borderRadius.md,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>✅</span>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 16, color: '#34d399' }}>
                {result.message}
              </div>
              {result.ticket && (
                <div style={{ fontSize: 13, color: '#a7f3d0', marginTop: 4 }}>
                  Passenger: <strong>{result.ticket.passengerName}</strong> · Seat: <strong>#{result.ticket.seatNumber}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Scan Warning */}
      {result && result.alreadyBoarded && (
        <div
          style={{
            marginTop: spacing.lg,
            padding: spacing.lg,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: borderRadius.md,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 15, color: '#f87171' }}>
                {result.message}
              </div>
              <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 4 }}>
                This QR ticket has already been used. Refuse duplicate entry.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: borderRadius.md,
            color: '#fca5a5',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          ❌ {errorMsg}
        </div>
      )}
    </div>
  );
}

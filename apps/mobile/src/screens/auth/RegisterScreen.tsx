import React, { useState } from 'react';
import { useAuthStore } from '../../stores/auth.store.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';

interface RegisterScreenProps {
  onNavigateToLogin?: () => void;
}

export function RegisterScreen({ onNavigateToLogin }: RegisterScreenProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !password) return;
    try {
      await register({
        fullName,
        phone,
        email: email || undefined,
        password,
      });
    } catch {
      // Handled by store
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: colors.background.primary,
        color: colors.text.primary,
        padding: spacing.lg,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.border.subtle}`,
          padding: spacing.xl,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', color: colors.brand.primary, margin: 0 }}>
            Create Account
          </h1>
          <p style={{ color: colors.text.secondary, fontSize: 14, marginTop: spacing.xs }}>
            Register as a RuralBus Passenger
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: spacing.sm,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${colors.status.error}`,
              borderRadius: borderRadius.md,
              color: colors.status.error,
              fontSize: 13,
              marginBottom: spacing.md,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{error}</span>
            <button
              onClick={clearError}
              style={{ background: 'none', border: 'none', color: colors.status.error, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: colors.text.secondary, marginBottom: 4 }}>
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: colors.background.tertiary,
                border: `1px solid ${colors.border.subtle}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, color: colors.text.secondary, marginBottom: 4 }}>
              Mobile Number (10 digits)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: colors.background.tertiary,
                border: `1px solid ${colors.border.subtle}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, color: colors.text.secondary, marginBottom: 4 }}>
              Email (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. passenger@example.com"
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: colors.background.tertiary,
                border: `1px solid ${colors.border.subtle}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, color: colors.text.secondary, marginBottom: 4 }}>
              Password (min 8 chars)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              required
              minLength={8}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: colors.background.tertiary,
                border: `1px solid ${colors.border.subtle}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: spacing.sm,
              padding: '12px 16px',
              backgroundColor: colors.brand.primary,
              color: '#000',
              fontWeight: 600,
              fontSize: 14,
              border: 'none',
              borderRadius: borderRadius.md,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {isLoading ? 'Registering...' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: spacing.lg, fontSize: 13, color: colors.text.secondary }}>
          Already have an account?{' '}
          <button
            onClick={onNavigateToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: colors.brand.primary,
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0,
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

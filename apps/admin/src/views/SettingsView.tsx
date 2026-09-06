import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchOperatorProfile, updateOperatorProfile } from '../services/operator.api.js';
import { useAdminAuthStore } from '../stores/auth.store.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { UpdateOperatorProfileInput } from '@ruralbus/shared-types';

export function SettingsView() {
  const queryClient = useQueryClient();
  const { user } = useAdminAuthStore();

  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Profile Query
  const { data: profile, isLoading } = useQuery({
    queryKey: ['operatorProfile'],
    queryFn: fetchOperatorProfile,
  });

  useEffect(() => {
    if (profile) {
      setCompanyName(profile.companyName);
      setContactEmail(profile.contactEmail);
      setContactPhone(profile.contactPhone);
    }
  }, [profile]);

  // 2. Update Profile Mutation
  const updateMutation = useMutation({
    mutationFn: (input: UpdateOperatorProfileInput) => updateOperatorProfile(input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['operatorProfile'] });
      setCompanyName(updated.companyName);
      setContactEmail(updated.contactEmail);
      setContactPhone(updated.contactPhone);
      setSuccessMsg('Operator profile updated successfully');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to update profile');
      setSuccessMsg(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    updateMutation.mutate({
      companyName,
      contactEmail,
      contactPhone,
    });
  };

  if (isLoading) {
    return <div style={{ color: colors.text.secondary }}>Loading operator profile...</div>;
  }

  return (
    <div
      style={{
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.border.subtle}`,
        padding: spacing.xl,
        maxWidth: 720,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>Operator Tenant Profile</h2>
          <p style={{ fontSize: 13, color: colors.text.secondary, margin: '4px 0 0 0' }}>
            Manage organization credentials, contact details, and multi-tenant RLS metadata.
          </p>
        </div>
        <span
          style={{
            padding: '4px 10px',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            color: colors.brand.primary,
            borderRadius: borderRadius.sm,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          ● {profile?.status || 'ACTIVE'}
        </span>
      </div>

      {successMsg && (
        <div style={{ padding: spacing.sm, backgroundColor: 'rgba(34, 197, 94, 0.15)', border: `1px solid ${colors.brand.primary}`, borderRadius: borderRadius.md, color: colors.brand.primary, fontSize: 13, marginBottom: spacing.md }}>
          ✓ {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: spacing.sm, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${colors.status.error}`, borderRadius: borderRadius.md, color: colors.status.error, fontSize: 13, marginBottom: spacing.md }}>
          ✕ {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: colors.text.secondary, marginBottom: 4 }}>
            Operator Company Name
          </label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, color: colors.text.secondary, marginBottom: 4 }}>
            Business Code (Unique Slug)
          </label>
          <input
            type="text"
            disabled
            value={profile?.businessCode || ''}
            style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(15, 23, 42, 0.5)', border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.brand.primary, fontSize: 14, fontFamily: 'monospace', boxSizing: 'border-box', cursor: 'not-allowed' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: colors.text.secondary, marginBottom: 4 }}>
              Contact Email
            </label>
            <input
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, color: colors.text.secondary, marginBottom: 4 }}>
              Contact Mobile Phone
            </label>
            <input
              type="tel"
              required
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${colors.border.subtle}`, paddingTop: spacing.md }}>
          <label style={{ fontSize: 12, color: colors.text.secondary }}>Administrator Account (Current Session)</label>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
            {user?.fullName} • {user?.phone}
          </div>
        </div>

        <button
          type="submit"
          disabled={updateMutation.isPending}
          style={{
            alignSelf: 'flex-start',
            padding: '10px 20px',
            backgroundColor: colors.brand.primary,
            color: '#000',
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            borderRadius: borderRadius.md,
            cursor: 'pointer',
          }}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
        </button>
      </form>
    </div>
  );
}

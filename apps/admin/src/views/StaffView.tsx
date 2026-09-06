import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchStaffMembers,
  createStaffMember,
  updateStaffStatus,
  resetStaffPassword,
} from '../services/staff.api.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';
import type { StaffMember, CreateStaffInput } from '@ruralbus/shared-types';

export function StaffView() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<'ALL' | 'DRIVER' | 'CONDUCTOR'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = useState<StaffMember | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'DRIVER' | 'CONDUCTOR'>('DRIVER');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Staff Query
  const { data, isLoading, isError } = useQuery({
    queryKey: ['staff', selectedRole, searchTerm],
    queryFn: () =>
      fetchStaffMembers({
        role: selectedRole === 'ALL' ? undefined : selectedRole,
        search: searchTerm || undefined,
      }),
  });

  // 2. Create Staff Mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateStaffInput) => createStaffMember(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setShowCreateModal(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setPassword('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to create staff member');
    },
  });

  // 3. Status Toggle Mutation
  const statusMutation = useMutation({
    mutationFn: ({ staffId, isActive }: { staffId: string; isActive: boolean }) =>
      updateStaffStatus(staffId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  // 4. Password Reset Mutation
  const resetMutation = useMutation({
    mutationFn: ({ staffId, newPass }: { staffId: string; newPass: string }) =>
      resetStaffPassword(staffId, newPass),
    onSuccess: () => {
      setPasswordResetTarget(null);
      setNewPassword('');
      setActionError(null);
      alert('Password reset successfully');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to reset password');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !password) return;
    createMutation.mutate({
      fullName,
      phone,
      email: email || undefined,
      role,
      password,
    });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetTarget || !newPassword) return;
    resetMutation.mutate({ staffId: passwordResetTarget.id, newPass: newPassword });
  };

  return (
    <div>
      {/* Top Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: spacing.lg,
          marginBottom: spacing.xl,
        }}
      >
        <div style={{ backgroundColor: colors.background.secondary, padding: spacing.lg, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}` }}>
          <div style={{ fontSize: 13, color: colors.text.secondary }}>Total Active Staff</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: colors.text.primary, marginTop: 4 }}>
            {data?.total ?? 0}
          </div>
          <div style={{ fontSize: 12, color: colors.brand.primary, marginTop: 4 }}>
            Single Unified Mobile Access
          </div>
        </div>

        <div style={{ backgroundColor: colors.background.secondary, padding: spacing.lg, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}` }}>
          <div style={{ fontSize: 13, color: colors.text.secondary }}>Active Drivers</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: colors.status.warning, marginTop: 4 }}>
            {data?.activeDrivers ?? 0}
          </div>
          <div style={{ fontSize: 12, color: colors.text.secondary, marginTop: 4 }}>
            Assigned to Live GPS Telemetry
          </div>
        </div>

        <div style={{ backgroundColor: colors.background.secondary, padding: spacing.lg, borderRadius: borderRadius.lg, border: `1px solid ${colors.border.subtle}` }}>
          <div style={{ fontSize: 13, color: colors.text.secondary }}>Active Conductors</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: colors.status.info, marginTop: 4 }}>
            {data?.activeConductors ?? 0}
          </div>
          <div style={{ fontSize: 12, color: colors.text.secondary, marginTop: 4 }}>
            Offline QR Ticket Validators
          </div>
        </div>
      </div>

      {/* Main Staff Table Container */}
      <div
        style={{
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.border.subtle}`,
          padding: spacing.xl,
        }}
      >
        {/* Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg, flexWrap: 'wrap', gap: spacing.md }}>
          <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
            {/* Filter Buttons */}
            {(['ALL', 'DRIVER', 'CONDUCTOR'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                style={{
                  padding: '6px 14px',
                  borderRadius: borderRadius.md,
                  backgroundColor: selectedRole === r ? colors.brand.primary : colors.background.tertiary,
                  color: selectedRole === r ? '#000' : colors.text.secondary,
                  border: `1px solid ${selectedRole === r ? colors.brand.primary : colors.border.subtle}`,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {r}
              </button>
            ))}

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search by name or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: borderRadius.md,
                backgroundColor: colors.background.tertiary,
                border: `1px solid ${colors.border.subtle}`,
                color: colors.text.primary,
                fontSize: 13,
                minWidth: 220,
              }}
            />
          </div>

          <button
            onClick={() => {
              setActionError(null);
              setShowCreateModal(true);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: colors.brand.primary,
              color: '#000',
              fontWeight: 600,
              borderRadius: borderRadius.md,
              border: 'none',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            + Provision New Staff
          </button>
        </div>

        {/* Staff Table */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.text.secondary }}>
            Loading operator staff roster...
          </div>
        ) : isError ? (
          <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.status.error }}>
            Failed to load staff members.
          </div>
        ) : data?.staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.text.secondary }}>
            No staff members found matching your search.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border.subtle}`, color: colors.text.secondary }}>
                <th style={{ padding: '12px 16px' }}>Staff Name</th>
                <th style={{ padding: '12px 16px' }}>Contact Phone</th>
                <th style={{ padding: '12px 16px' }}>Role</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.staff.map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${colors.border.subtle}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {s.fullName}
                    {s.email && <div style={{ fontSize: 11, color: colors.text.tertiary }}>{s.email}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{s.phone}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: borderRadius.sm,
                        fontSize: 11,
                        fontWeight: 'bold',
                        backgroundColor:
                          s.role === 'DRIVER'
                            ? 'rgba(234, 179, 8, 0.15)'
                            : 'rgba(59, 130, 246, 0.15)',
                        color: s.role === 'DRIVER' ? colors.status.warning : colors.status.info,
                      }}
                    >
                      {s.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: borderRadius.sm,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: s.isActive
                          ? 'rgba(34, 197, 94, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                        color: s.isActive ? colors.brand.primary : colors.status.error,
                      }}
                    >
                      {s.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
                      <button
                        onClick={() =>
                          statusMutation.mutate({ staffId: s.id, isActive: !s.isActive })
                        }
                        style={{
                          padding: '4px 8px',
                          backgroundColor: colors.background.tertiary,
                          color: colors.text.secondary,
                          border: `1px solid ${colors.border.subtle}`,
                          borderRadius: borderRadius.sm,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        {s.isActive ? 'Suspend' : 'Activate'}
                      </button>

                      <button
                        onClick={() => {
                          setActionError(null);
                          setPasswordResetTarget(s);
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: colors.background.tertiary,
                          color: colors.brand.primary,
                          border: `1px solid ${colors.border.subtle}`,
                          borderRadius: borderRadius.sm,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 1. Add Staff Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              backgroundColor: colors.background.secondary,
              borderRadius: borderRadius.lg,
              border: `1px solid ${colors.border.subtle}`,
              padding: spacing.xl,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <h3 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>Provision Staff Member</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: colors.text.secondary, cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div style={{ padding: spacing.sm, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${colors.status.error}`, borderRadius: borderRadius.md, color: colors.status.error, fontSize: 12, marginBottom: spacing.md }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: colors.text.secondary, marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Gowda"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: colors.text.secondary, marginBottom: 4 }}>
                  Mobile Number (10 digits)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: colors.text.secondary, marginBottom: 4 }}>
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. driver@ksrtc.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: colors.text.secondary, marginBottom: 4 }}>
                  Operational Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'DRIVER' | 'CONDUCTOR')}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                >
                  <option value="DRIVER">DRIVER (Assigned to Live GPS Duty HUD)</option>
                  <option value="CONDUCTOR">CONDUCTOR (Assigned to QR Ticket Scanner)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: colors.text.secondary, marginBottom: 4 }}>
                  Initial Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Assign initial password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: colors.background.tertiary, color: colors.text.secondary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  style={{ padding: '8px 18px', backgroundColor: colors.brand.primary, color: '#000', fontWeight: 600, border: 'none', borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  {createMutation.isPending ? 'Provisioning...' : 'Provision Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Reset Password Modal */}
      {passwordResetTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
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
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 'bold', margin: '0 0 8px 0' }}>
              Reset Password for {passwordResetTarget.fullName}
            </h3>
            <p style={{ fontSize: 12, color: colors.text.secondary, margin: '0 0 16px 0' }}>
              Set a new Argon2id password for mobile login ({passwordResetTarget.phone}).
            </p>

            {actionError && (
              <div style={{ padding: spacing.sm, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${colors.status.error}`, borderRadius: borderRadius.md, color: colors.status.error, fontSize: 12, marginBottom: spacing.md }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: colors.text.secondary, marginBottom: 4 }}>
                  New Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, color: colors.text.primary, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
                <button
                  type="button"
                  onClick={() => setPasswordResetTarget(null)}
                  style={{ padding: '8px 16px', backgroundColor: colors.background.tertiary, color: colors.text.secondary, border: `1px solid ${colors.border.subtle}`, borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetMutation.isPending}
                  style={{ padding: '8px 18px', backgroundColor: colors.brand.primary, color: '#000', fontWeight: 600, border: 'none', borderRadius: borderRadius.md, fontSize: 13, cursor: 'pointer' }}
                >
                  {resetMutation.isPending ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

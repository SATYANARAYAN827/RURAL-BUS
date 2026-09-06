import React from 'react';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLight?: boolean;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isLight = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20000,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 380,
          backgroundColor: isLight ? '#ffffff' : '#0a101d',
          border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)'}`,
          borderRadius: 20,
          padding: '24px 22px 20px',
          boxShadow: isLight
            ? '0 20px 40px -8px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(0, 0, 0, 0.05)'
            : '0 25px 60px rgba(0,0,0,0.85)',
          textAlign: 'center',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.18s ease-out',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: 'rgba(225, 29, 72, 0.12)',
            border: '1.5px solid rgba(225, 29, 72, 0.35)',
            color: '#e11d48',
            fontSize: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 4px 14px rgba(225, 29, 72, 0.2)',
          }}
        >
          🚪
        </div>

        <h3
          id="logout-modal-title"
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: isLight ? '#0f172a' : '#ffffff',
            margin: '0 0 6px 0',
            letterSpacing: -0.3,
          }}
        >
          Are you sure you want to exit?
        </h3>

        <p
          style={{
            fontSize: 13,
            color: isLight ? '#64748b' : '#94a3b8',
            margin: '0 0 22px 0',
            lineHeight: 1.5,
          }}
        >
          You will be logged out of your RuralBus account and returned to the sign-in screen.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '12px',
              borderRadius: 12,
              backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)'}`,
              color: isLight ? '#334155' : '#f8fafc',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            No, Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '12px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(225, 29, 72, 0.35)',
              transition: 'transform 0.15s ease',
            }}
          >
            Yes, Exit
          </button>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import { useAdminAuthStore } from '../stores/auth.store.js';

export function WelcomeModal() {
  const { user, showWelcome, dismissWelcome } = useAdminAuthStore();
  const [progress, setProgress] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!showWelcome) {
      setProgress(0);
      setIsClosing(false);
      return;
    }

    // Smooth progress bar animation over 2.4 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 4;
      });
    }, 90);

    // Auto-dismiss after 2.6 seconds
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => {
        dismissWelcome();
      }, 300);
    }, 2600);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [showWelcome, dismissWelcome]);

  if (!showWelcome || !user) return null;

  const getRoleConfig = () => {
    switch (user.role) {
      case 'PASSENGER':
        return {
          icon: '🎒',
          badge: 'PASSENGER ACCESS',
          badgeBg: '#dcfce7',
          badgeColor: '#15803d',
          title: `Welcome, ${user.fullName.split(' ')[0]}!`,
          subtitle: 'Search routes, live track buses & explore rural transit across regional corridors.',
          actionText: 'Enter Passenger Portal',
        };
      case 'DRIVER':
        return {
          icon: '🧑‍✈️',
          badge: 'DRIVER ON DUTY',
          badgeBg: '#fef3c7',
          badgeColor: '#b45309',
          title: `Welcome on Duty, ${user.fullName.split(' ')[0]}!`,
          subtitle: 'Your trip HUD, live GPS broadcasting & route waypoint tracking are ready.',
          actionText: 'Open Driver HUD',
        };
      case 'CONDUCTOR':
        return {
          icon: '🎫',
          badge: 'CONDUCTOR STATION',
          badgeBg: '#ede9fe',
          badgeColor: '#6d28d9',
          title: `Welcome on Duty, ${user.fullName.split(' ')[0]}!`,
          subtitle: 'QR validator, passenger manifest & offline cash POS are ready.',
          actionText: 'Open Conductor POS',
        };
      case 'PLATFORM_ADMIN':
        return {
          icon: '⚡',
          badge: 'SUPER ADMIN ROOT ACCESS',
          badgeBg: '#f3e8ff',
          badgeColor: '#7e22ce',
          title: `Welcome, Administrator ${user.fullName.split(' ')[0]}!`,
          subtitle: 'State transit fleet oversight, operator allocations, and system authorizations ready.',
          actionText: 'Enter Super Admin Console',
        };
      case 'OPERATOR_ADMIN':
      default:
        return {
          icon: '🏢',
          badge: 'FLEET OPERATOR DASHBOARD',
          badgeBg: '#dcfce7',
          badgeColor: '#15803d',
          title: `Welcome Back, ${user.fullName.split(' ')[0]}!`,
          subtitle: 'Real-time fleet tracking, daily revenue, routes & staff operations loaded.',
          actionText: 'Open Fleet Dashboard',
        };
    }
  };

  const config = getRoleConfig();

  const handleManualDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      dismissWelcome();
    }, 250);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
        opacity: isClosing ? 0 : 1,
        transform: isClosing ? 'scale(0.96)' : 'scale(1)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#ffffff',
          borderRadius: 24,
          boxShadow: '0 20px 50px -10px rgba(0,0,0,0.35), 0 0 0 1.5px rgba(22, 163, 74, 0.25)',
          overflow: 'hidden',
          textAlign: 'center',
          animation: 'welcomePopIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        }}
      >
        <style>{`
          @keyframes welcomePopIn {
            0% { transform: scale(0.88) translateY(16px); opacity: 0; }
            100% { transform: scale(1) translateY(0); opacity: 1; }
          }
          @keyframes pulseGlow {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
            50% { transform: scale(1.06); box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); }
          }
          @keyframes busDrive {
            0% { transform: translateX(-6px); }
            50% { transform: translateX(6px); }
            100% { transform: translateX(-6px); }
          }
        `}</style>

        {/* Top Header Graphic */}
        <div
          style={{
            background: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)',
            padding: '32px 20px 24px 20px',
            color: '#ffffff',
            position: 'relative',
          }}
        >
          {/* Animated Avatar / Icon */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              margin: '0 auto 12px auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              animation: 'pulseGlow 2.2s ease-in-out infinite',
            }}
          >
            <span style={{ animation: 'busDrive 2s ease-in-out infinite', display: 'inline-block' }}>
              {config.icon}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>RURAL</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#4ade80', letterSpacing: -0.5 }}>BUS</span>
          </div>

          <span
            style={{
              display: 'inline-block',
              padding: '3px 12px',
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.5,
              backgroundColor: config.badgeBg,
              color: config.badgeColor,
              textTransform: 'uppercase',
            }}
          >
            {config.badge}
          </span>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 24px 28px 24px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: -0.3 }}>
            {config.title}
          </h2>

          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: '0 0 20px 0' }}>
            {config.subtitle}
          </p>

          {/* Animated Progress Bar */}
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                height: 6,
                backgroundColor: '#f1f5f9',
                borderRadius: 4,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                  borderRadius: 4,
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                fontWeight: 600,
                color: '#94a3b8',
                marginTop: 6,
              }}
            >
              <span>Authenticating session...</span>
              <span>{Math.min(100, Math.round(progress))}%</span>
            </div>
          </div>

          {/* Continue Action Button */}
          <button
            type="button"
            onClick={handleManualDismiss}
            style={{
              width: '100%',
              padding: '13px 20px',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background-color 0.15s, transform 0.1s',
            }}
          >
            <span>{config.actionText}</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

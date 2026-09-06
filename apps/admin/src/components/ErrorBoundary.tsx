import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Robust Error Boundary to catch any runtime or HMR errors
 * and prevent whole-page unmounting or white screens.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#020608',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: 420,
              padding: 28,
              borderRadius: 20,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚌</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px 0', color: '#00D488' }}>
              RuralBus Portal
            </h2>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              A temporary display refresh occurred. Click below to restore the portal.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                backgroundColor: '#00D488',
                color: '#020608',
                fontWeight: 800,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 212, 136, 0.4)',
              }}
            >
              Refresh Portal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            textAlign: 'center',
            background: '#f8fafc',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              background: '#FEF2F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              border: '1.5px solid #FECACA',
              fontSize: 32,
            }}
          >
            {'\u{1F615}'}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24, maxWidth: 280 }}>
            Don't worry, your data is safe. Try restarting the app.
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 32px',
              borderRadius: 14,
              border: 'none',
              fontWeight: 700,
              fontSize: 15,
              background: '#0f2b4c',
              color: '#fff',
              minHeight: 44,
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Try again
          </button>
          {this.state.error && (
            <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 20, fontFamily: 'monospace', maxWidth: 300, wordBreak: 'break-all' }}>
              {this.state.error.message}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

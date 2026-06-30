import { Component, type ErrorInfo, type ReactNode, type CSSProperties } from 'react';

/**
 * Catches render / lifecycle errors in its subtree so one broken view or widget
 * can't take down the whole app. React unmounts the ENTIRE component tree on an
 * uncaught render error, which presents as "the app froze and no buttons work" —
 * an error boundary stops the blast radius at this node and shows a recovery UI
 * instead.
 *
 * Wrap the main content with `key={activeSection}` so navigating to a different
 * section automatically clears a crashed one.
 */
interface Props {
  children: ReactNode;
  /** Human label for what failed, e.g. "this section". */
  label?: string;
  /** Optional recovery action (e.g. go back to Home). */
  onReset?: () => void;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface it for diagnosis instead of swallowing it.
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const label = this.props.label ?? 'this view';
    return (
      <div style={WRAP}>
        <div style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Something went wrong in {label}.
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--app-text-muted, #888)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          The rest of the app still works. Switch to another section, or reload.
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={this.reset} style={btn(true)}>Try again</button>
          {this.props.onReset && (
            <button onClick={() => { this.reset(); this.props.onReset!(); }} style={btn(false)}>Go home</button>
          )}
          <button onClick={() => location.reload()} style={btn(false)}>Reload app</button>
        </div>
        <details style={{ marginTop: '1.25rem', textAlign: 'left' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.78rem', color: 'var(--app-text-dim, #777)' }}>
            Error details
          </summary>
          <pre style={{ marginTop: '0.5rem', fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--app-text-muted, #999)' }}>
            {String(error.message || error)}
          </pre>
        </details>
      </div>
    );
  }
}

const WRAP: CSSProperties = {
  margin: '2rem auto', maxWidth: 520, textAlign: 'center',
  padding: '2rem 1.5rem', borderRadius: 16,
  background: 'var(--app-bg-alt, rgba(127,127,127,0.08))',
  color: 'var(--app-text, inherit)',
  border: '1px solid var(--app-border, rgba(127,127,127,0.2))',
  fontFamily: 'var(--app-font, system-ui, sans-serif)',
};

function btn(primary: boolean): CSSProperties {
  return {
    padding: '0.5rem 1.1rem', borderRadius: 999, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 500,
    border: primary ? 'none' : '1px solid var(--app-border-strong, rgba(127,127,127,0.35))',
    background: primary ? '#5266eb' : 'transparent',
    color: primary ? '#fff' : 'var(--app-text, inherit)',
  };
}

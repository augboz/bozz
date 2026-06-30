import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { VoiceCapture, isVoiceSupported } from '../../lib/voice';
import type { Theme } from '../../lib/types';

interface Props {
  t: Theme;
  /** Called once with the final transcript when recording stops. */
  onTranscript: (text: string) => void;
  /** Optional live (partial) transcript callback. */
  onPartial?: (text: string) => void;
  /** Optional error callback. */
  onError?: (msg: string) => void;
  /** Fires when recording starts (true) or stops (false). */
  onRecordingChange?: (recording: boolean) => void;
  /** Show the word "Talk" / "Stop" alongside the icon. */
  label?: boolean;
  /** Compact icon-only style (used in the collapsed sidebar). */
  iconOnly?: boolean;
  /** Override the icon size. */
  iconSize?: number;
}

export default function VoiceButton({
  t, onTranscript, onPartial, onError, onRecordingChange, label, iconOnly, iconSize = 15,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const capRef = useRef<VoiceCapture | null>(null);

  useEffect(() => () => { capRef.current?.abort(); }, []);

  const toggle = () => {
    if (recording) { capRef.current?.stop(); return; }
    if (!isVoiceSupported()) {
      const m = 'Voice input not available in this build';
      setErr(m); onError?.(m); return;
    }
    setErr(null);
    try {
      const cap = new VoiceCapture({
        onPartial,
        onFinal: (final) => onTranscript(final),
        onError: (msg) => { setErr(msg); onError?.(msg); setRecording(false); onRecordingChange?.(false); },
        onEnd:   () => { setRecording(false); onRecordingChange?.(false); capRef.current = null; },
      });
      capRef.current = cap;
      cap.start();
      setRecording(true);
      onRecordingChange?.(true);
    } catch (e) {
      const m = String(e);
      setErr(m); onError?.(m);
    }
  };

  const Icon = recording ? MicOff : Mic;

  return (
    <button
      onClick={toggle}
      title={err ?? (recording ? 'Stop recording' : 'Talk to Bozz')}
      aria-pressed={recording}
      style={{
        background: recording ? '#dc5050' : 'transparent',
        border: `1px solid ${recording ? '#dc5050' : err ? '#dc5050' : t.border}`,
        color: recording ? '#fff' : err ? '#dc5050' : t.textMuted,
        borderRadius: iconOnly ? '999px' : '7px',
        padding: iconOnly ? '0.42rem' : '0.4rem 0.6rem',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        fontSize: '0.78rem',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        animation: recording ? 'voicePulse 1.4s infinite' : 'none',
        flexShrink: 0,
      }}
    >
      <Icon size={iconSize} strokeWidth={1.5} />
      {label && !iconOnly && (recording ? 'Stop' : 'Talk')}
    </button>
  );
}

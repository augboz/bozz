// Thin wrapper around the WebView2 SpeechRecognition API.
//
// Tauri on Windows ships WebView2 (Chromium-based), which exposes
// `webkitSpeechRecognition`. The recogniser captures continuously until
// `stop()` is called, accumulating final results internally and surfacing
// partial transcripts via `onPartial`.

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SRResult { isFinal: boolean; 0: { transcript: string } }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SRClass {
  new (): SR;
}
interface SR {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

function getSRClass(): SRClass | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRClass; webkitSpeechRecognition?: SRClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return getSRClass() != null;
}

export interface VoiceCallbacks {
  onPartial?: (combinedTranscript: string) => void;
  onFinal?: (finalTranscript: string) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
}

export class VoiceCapture {
  private rec: SR;
  private cbs: VoiceCallbacks;
  private finalText = '';

  constructor(cbs: VoiceCallbacks) {
    const SRClass = getSRClass();
    if (!SRClass) throw new Error('SpeechRecognition not supported on this platform');
    this.cbs = cbs;
    this.rec = new SRClass();
    this.rec.continuous = true;
    this.rec.interimResults = true;
    this.rec.lang = 'en-GB';

    this.rec.onresult = (e: SREvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const transcript = r[0].transcript;
        if (r.isFinal) this.finalText += transcript;
        else interim += transcript;
      }
      this.cbs.onPartial?.((this.finalText + interim).trim());
    };
    this.rec.onerror = (e) => {
      this.cbs.onError?.(String(e.error ?? e.message ?? 'speech error'));
    };
    this.rec.onend = () => {
      const text = this.finalText.trim();
      if (text) this.cbs.onFinal?.(text);
      this.cbs.onEnd?.();
    };
  }

  start(): void { this.finalText = ''; this.rec.start(); }
  stop(): void  { try { this.rec.stop(); } catch { /* already stopped */ } }
  abort(): void { try { this.rec.abort(); } catch { /* already stopped */ } }
}

import type { TTSVoiceOption } from '../types/videoStudio';

export interface SpeakOptions {
  voiceUri?: string;
  lang?: string;
  rate?: number; // 0.8 a 1.3
  pitch?: number; // 0.8 a 1.2
  volume?: number; // 0 a 1
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (event: { charIndex: number; charLength?: number; name?: string }) => void;
  onError?: (error: Error) => void;
}

class TTSService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private keepAliveTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();

      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', () => this.loadVoices());
      }
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
      if (window.addEventListener) {
        window.addEventListener('focus', () => {
          if (this.synth && this.synth.paused) {
            try {
              this.synth.resume();
            } catch {
              // ignore
            }
          }
        });
      }
    }
  }

  public loadVoices(): void {
    if (!this.synth) return;
    try {
      const v = this.synth.getVoices();
      if (v && v.length > 0) {
        this.voices = v;
      }
    } catch (e) {
      console.warn('Error al cargar voces:', e);
    }
  }

  public getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }

  public isSupported(): boolean {
    return !!this.synth;
  }

  public getAvailableVoices(): TTSVoiceOption[] {
    if (!this.synth) {
      return [
        {
          id: 'mock-es-latam',
          name: 'Voz Sintetizada Didáctica (Latinoamérica)',
          lang: 'es-419',
          gender: 'female',
          isLocal: true,
          provider: 'custom',
        },
      ];
    }

    if (this.voices.length === 0) {
      this.loadVoices();
    }

    const spanishVoices = this.voices.filter(v => (v.lang || '').toLowerCase().startsWith('es'));
    const allCandidateVoices = spanishVoices.length > 0 ? spanishVoices : this.voices;

    const mapped: TTSVoiceOption[] = allCandidateVoices.map(v => {
      const lang = (v.lang || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const isLatam =
        lang.includes('419') ||
        lang.includes('mx') ||
        lang.includes('ar') ||
        lang.includes('co') ||
        lang.includes('cl') ||
        name.includes('latino') ||
        name.includes('mexico');

      const isFemale =
        name.includes('female') ||
        name.includes('sabina') ||
        name.includes('helena') ||
        name.includes('lucia') ||
        name.includes('paulina') ||
        name.includes('hilda') ||
        name.includes('mia');

      const isMale =
        name.includes('male') ||
        name.includes('raul') ||
        name.includes('pablo') ||
        name.includes('jorge') ||
        name.includes('diego');

      return {
        id: v.voiceURI || v.name,
        name: `${v.name} (${v.lang})${isLatam ? ' ⭐ Latino' : ''}`,
        lang: v.lang,
        gender: isFemale ? 'female' : isMale ? 'male' : 'neutral',
        isLocal: v.localService,
        provider: 'webspeech',
      };
    });

    return mapped.sort((a, b) => {
      const aIsLatam = a.lang.includes('419') || a.lang.includes('MX') || a.name.includes('Latino');
      const bIsLatam = b.lang.includes('419') || b.lang.includes('MX') || b.name.includes('Latino');
      if (aIsLatam && !bIsLatam) return -1;
      if (!aIsLatam && bIsLatam) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  public getPreferredVoice(preferredLang: string = 'es-LATAM'): SpeechSynthesisVoice | null {
    if (!this.synth) return null;

    if (this.voices.length === 0) {
      this.loadVoices();
    }
    if (this.voices.length === 0) return null;

    // 1. Preferir español latinoamericano
    const latamVoice = this.voices.find(v => {
      const l = (v.lang || '').toLowerCase();
      const n = (v.name || '').toLowerCase();
      return (
        l.includes('es-419') ||
        l.includes('es-mx') ||
        l.includes('es-ar') ||
        l.includes('es-co') ||
        l.includes('es-cl') ||
        l.includes('es-pe') ||
        l.includes('es-us') ||
        n.includes('latino') ||
        n.includes('mexico') ||
        n.includes('sabina') ||
        n.includes('raul')
      );
    });
    if (latamVoice) return latamVoice;

    // 2. Cualquier voz en español
    const anySpanish = this.voices.find(v => (v.lang || '').toLowerCase().startsWith('es'));
    if (anySpanish) return anySpanish;

    return null;
  }

  public estimateDurationSeconds(
    text: string,
    rate: number = 1.0,
    options?: { includeBreathingPause?: boolean; wordsPerMinute?: number }
  ): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words === 0) return 4;

    const wpm = (options?.wordsPerMinute || 145) * Math.max(0.6, Math.min(1.8, rate));
    const speechTimeSeconds = (words / wpm) * 60;

    const commas = (text.match(/[,;:]/g) || []).length;
    const periods = (text.match(/[.!?]/g) || []).length;
    const punctuationPause = commas * 0.35 + periods * 0.6;
    const breathingPause = options?.includeBreathingPause !== false ? 1.5 : 0;

    return Math.max(5, Math.round(speechTimeSeconds + punctuationPause + breathingPause));
  }

  public speak(text: string, options: SpeakOptions = {}): void {
    const clean = text?.trim();
    if (!clean) {
      if (options.onEnd) options.onEnd();
      return;
    }

    this.stop();

    if (!this.synth) {
      if (options.onStart) options.onStart();
      const fakeDuration = this.estimateDurationSeconds(clean, options.rate || 1.0) * 1000;
      setTimeout(() => {
        if (options.onEnd) options.onEnd();
      }, fakeDuration);
      return;
    }

    try {
      if (this.synth.paused) {
        this.synth.resume();
      }
    } catch {
      // ignore
    }

    if (this.voices.length === 0) {
      this.loadVoices();
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    this.currentUtterance = utterance;

    if (typeof window !== 'undefined') {
      (window as unknown as { __activeUtterance?: SpeechSynthesisUtterance }).__activeUtterance = utterance;
    }

    let matchedVoice: SpeechSynthesisVoice | null = null;
    if (options.voiceUri) {
      matchedVoice =
        this.voices.find(v => v.voiceURI === options.voiceUri || v.name === options.voiceUri) ||
        null;
    }
    if (!matchedVoice) {
      matchedVoice = this.getPreferredVoice(options.lang || 'es-LATAM');
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice;
      utterance.lang = matchedVoice.lang || 'es-ES';
    } else {
      utterance.lang = 'es-ES';
    }

    utterance.rate = Math.max(0.8, Math.min(1.3, options.rate || 1.0));
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume !== undefined ? options.volume : 1.0;

    utterance.onstart = () => {
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
      this.currentUtterance = null;
      if (typeof window !== 'undefined') {
        (window as unknown as { __activeUtterance?: SpeechSynthesisUtterance | null }).__activeUtterance = null;
      }
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
      this.currentUtterance = null;
      if (typeof window !== 'undefined') {
        (window as unknown as { __activeUtterance?: SpeechSynthesisUtterance | null }).__activeUtterance = null;
      }
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('TTS error:', e.error);
        if (options.onError) {
          options.onError(new Error(e.error || 'Error en síntesis de voz'));
        }
      }
    };

    utterance.onboundary = (e) => {
      if (options.onBoundary) {
        options.onBoundary({
          charIndex: e.charIndex,
          charLength: e.charLength,
          name: e.name,
        });
      }
    };

    try {
      this.synth.speak(utterance);

      if (this.synth.paused) {
        this.synth.resume();
      }

      this.keepAliveTimer = window.setInterval(() => {
        if (!this.synth || !this.synth.speaking) {
          if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
          return;
        }
        try {
          this.synth.pause();
          this.synth.resume();
        } catch {
          // ignore
        }
      }, 10000);
    } catch (err) {
      console.warn('Fallo al invocar speechSynthesis.speak:', err);
      if (options.onError) options.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  public stop(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    if (this.synth) {
      try {
        if (this.synth.paused) {
          this.synth.resume();
        }
        this.synth.cancel();
      } catch {
        // ignore
      }
    }
    this.currentUtterance = null;
    if (typeof window !== 'undefined') {
      (window as unknown as { __activeUtterance?: SpeechSynthesisUtterance | null }).__activeUtterance = null;
    }
  }

  public pause(): void {
    if (this.synth && this.synth.speaking) {
      try {
        this.synth.pause();
      } catch {
        // ignore
      }
    }
  }

  public resume(): void {
    if (this.synth) {
      try {
        if (this.synth.paused) {
          this.synth.resume();
        } else if (!this.synth.speaking && this.currentUtterance) {
          this.synth.speak(this.currentUtterance);
        }
      } catch {
        // ignore
      }
    }
  }
}

export const ttsService = new TTSService();

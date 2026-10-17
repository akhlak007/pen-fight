export interface AudioPlayer {
  loop: boolean;
  volume: number;
  preload: string;
  play(): Promise<void> | void;
  pause(): void;
}

export type AudioPlayerFactory = (src: string) => AudioPlayer | null;

function defaultAudioFactory(src: string): AudioPlayer | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  try {
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0.35;
    audio.preload = 'auto';
    return audio;
  } catch {
    return null;
  }
}

export class AmbienceService {
  #player: AudioPlayer | null = null;
  #enabled = true;
  #isPlaying = false;
  #shouldPlay = false;
  #cleanupListeners: (() => void) | null = null;

  constructor(
    audioSrc = '/audio/sound_of_class.mp3',
    factory: AudioPlayerFactory = defaultAudioFactory,
  ) {
    this.#player = factory(audioSrc);

    if (typeof window !== 'undefined') {
      const unlock = () => {
        if (this.#shouldPlay && this.#enabled && !this.#isPlaying) {
          this.#playSafe();
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
      this.#cleanupListeners = () => {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
      };
    }
  }

  get isEnabled(): boolean {
    return this.#enabled;
  }

  get isPlaying(): boolean {
    return this.#isPlaying;
  }

  get shouldPlay(): boolean {
    return this.#shouldPlay;
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (!enabled) {
      this.#pauseSafe();
    } else if (this.#shouldPlay) {
      this.#playSafe();
    }
  }

  startGameAmbience(): void {
    this.#shouldPlay = true;
    if (this.#enabled) {
      this.#playSafe();
    }
  }

  stopGameAmbience(): void {
    this.#shouldPlay = false;
    this.#pauseSafe();
  }

  pauseForVisibility(): void {
    if (this.#shouldPlay && this.#enabled) {
      this.#pauseSafe();
    }
  }

  resumeFromVisibility(): void {
    if (this.#shouldPlay && this.#enabled) {
      this.#playSafe();
    }
  }

  destroy(): void {
    this.stopGameAmbience();
    this.#cleanupListeners?.();
    this.#cleanupListeners = null;
    this.#player = null;
  }

  #playSafe(): void {
    if (!this.#player) return;
    try {
      const res = this.#player.play();
      if (res && typeof (res as Promise<void>).then === 'function') {
        (res as Promise<void>)
          .then(() => {
            this.#isPlaying = true;
          })
          .catch(() => {
            this.#isPlaying = false;
          });
      } else {
        this.#isPlaying = true;
      }
    } catch {
      this.#isPlaying = false;
    }
  }

  #pauseSafe(): void {
    if (!this.#player) return;
    try {
      this.#player.pause();
    } catch {
      // Ignore audio pause errors
    }
    this.#isPlaying = false;
  }
}

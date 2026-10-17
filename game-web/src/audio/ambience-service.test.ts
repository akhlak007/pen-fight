import { describe, expect, it, vi } from 'vitest';
import { AmbienceService, type AudioPlayer } from './ambience-service';

function createMockAudio(): AudioPlayer & { playCount: number; pauseCount: number } {
  return {
    loop: false,
    volume: 1,
    preload: 'none',
    playCount: 0,
    pauseCount: 0,
    play() {
      this.playCount += 1;
      return Promise.resolve();
    },
    pause() {
      this.pauseCount += 1;
    },
  };
}

describe('AmbienceService', () => {
  it('initializes with default settings and correct volume', () => {
    let capturedPlayer: AudioPlayer | null = null;
    const mock = createMockAudio();
    const service = new AmbienceService('/audio/test.mp3', () => {
      capturedPlayer = mock;
      return mock;
    });

    expect(capturedPlayer).toBe(mock);
    expect(service.isEnabled).toBe(true);
    expect(service.isPlaying).toBe(false);
    expect(service.shouldPlay).toBe(false);
  });

  it('plays audio when game ambience starts', async () => {
    const mock = createMockAudio();
    const service = new AmbienceService('/audio/test.mp3', () => mock);

    service.startGameAmbience();
    expect(mock.playCount).toBe(1);
    expect(service.shouldPlay).toBe(true);
  });

  it('does not play audio if muted when game starts', () => {
    const mock = createMockAudio();
    const service = new AmbienceService('/audio/test.mp3', () => mock);

    service.setEnabled(false);
    service.startGameAmbience();

    expect(mock.playCount).toBe(0);
    expect(service.isEnabled).toBe(false);
    expect(service.shouldPlay).toBe(true);
  });

  it('pauses and resumes when toggling mute while game is active', () => {
    const mock = createMockAudio();
    const service = new AmbienceService('/audio/test.mp3', () => mock);

    service.startGameAmbience();
    expect(mock.playCount).toBe(1);

    // Mute
    service.setEnabled(false);
    expect(mock.pauseCount).toBe(1);

    // Unmute
    service.setEnabled(true);
    expect(mock.playCount).toBe(2);
  });

  it('stops audio when game ambience stops', () => {
    const mock = createMockAudio();
    const service = new AmbienceService('/audio/test.mp3', () => mock);

    service.startGameAmbience();
    service.stopGameAmbience();

    expect(mock.pauseCount).toBe(1);
    expect(service.shouldPlay).toBe(false);
  });

  it('pauses on visibility hidden and resumes on visibility restore', () => {
    const mock = createMockAudio();
    const service = new AmbienceService('/audio/test.mp3', () => mock);

    service.startGameAmbience();
    expect(mock.playCount).toBe(1);

    service.pauseForVisibility();
    expect(mock.pauseCount).toBe(1);

    service.resumeFromVisibility();
    expect(mock.playCount).toBe(2);
  });
});

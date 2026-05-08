/**
 * Player Engine
 * Core audio playback controller. Orchestrates playback, modes, events,
 * and integrates with PlaybackStateMachine, ShuffleEngine, AudioPipeline,
 * and PersistenceManager.
 */

import { PlaybackStateMachine } from './playback-state-machine.js';
import { ShuffleEngine } from './shuffle-engine.js';
import { AudioPipeline } from './audio-pipeline.js';
import { PersistenceManager } from './persistence-manager.js';

export class PlayerEngine {
  /**
   * @param {Array<{filename: string, path: string, title: string}>} tracks
   * @param {object} [options]
   * @param {boolean} [options.gainNormalization=true]
   */
  constructor(tracks, options = {}) {
    this._tracks = tracks;
    this._gainNormalization = options.gainNormalization !== false;

    // State
    this._currentTrackIndex = -1;
    this._selectedTrackIndex = -1;
    this._volume = 1.0;
    this._muted = false;
    this._shuffleEnabled = false;
    this._status = 'idle'; // idle | playing | paused | buffering | error

    // Sub-systems
    this._stateMachine = new PlaybackStateMachine();
    this._shuffleEngine = null;
    this._audioPipeline = new AudioPipeline();
    this._persistence = new PersistenceManager();

    // Audio elements
    this._audio = new Audio();
    this._audio.preload = 'none';
    this._prefetchAudio = null;
    this._audioConnected = false;

    // Normalization measurement timer
    this._normalizationTimeout = null;

    // Event listeners
    this._listeners = {};
    this._boundHandlers = {};

    this._setupAudioEvents();
    this._restoreState();
  }

  // === PLAYBACK CONTROLS ===

  play(index) {
    if (index < 0 || index >= this._tracks.length) return;

    this._currentTrackIndex = index;
    this._status = 'buffering';
    this._emit('trackChange', { index, track: this._tracks[index] });

    const track = this._tracks[index];
    this._audio.src = track.path;
    this._audio.preload = 'auto';
    this._audio.load();

    // Connect to Web Audio pipeline on first play
    if (!this._audioConnected && this._audioPipeline.isWebAudioAvailable()) {
      this._audioPipeline.connect(this._audio);
      this._audioConnected = true;
    }

    // Apply cached gain or default
    if (this._gainNormalization) {
      const cachedGain = this._audioPipeline.getCachedGain(track.filename);
      if (cachedGain) {
        this._audioPipeline.setGain(cachedGain);
      } else {
        this._audioPipeline.setGain(1.0);
        // Measure after 2 seconds of playback
        this._normalizationTimeout = setTimeout(() => {
          this._audioPipeline.measureAndCacheGain(track.filename);
        }, 2000);
      }
    }

    // Set volume
    this._applyVolume();

    const playPromise = this._audio.play();
    if (playPromise) {
      playPromise.catch((err) => {
        if (err.name !== 'AbortError') {
          this._handleError();
        }
      });
    }

    this._persistState();
    this._schedulePrefetch();
  }

  pause() {
    if (this._status !== 'playing' && this._status !== 'buffering') return;
    this._audio.pause();
    this._status = 'paused';
    this._emit('pause');
  }

  resume() {
    if (this._status !== 'paused') return;
    const playPromise = this._audio.play();
    if (playPromise) {
      playPromise.catch(() => {});
    }
  }

  stop() {
    this._audio.pause();
    this._audio.currentTime = 0;
    this._status = 'idle';
    this._currentTrackIndex = -1;
    this._cancelPrefetch();
    this._clearNormalizationTimer();
    this._emit('stop');
  }

  skipForward() {
    if (this._tracks.length === 0) return;

    let nextIndex;
    if (this._shuffleEnabled && this._shuffleEngine) {
      const currentPos = this._shuffleEngine.getPositionOf(this._currentTrackIndex);
      const nextPos = currentPos + 1;
      if (nextPos >= this._shuffleEngine.getLength()) {
        this._shuffleEngine.reshuffle();
        nextIndex = this._shuffleEngine.getTrackAt(0);
      } else {
        nextIndex = this._shuffleEngine.getTrackAt(nextPos);
      }
    } else {
      nextIndex = (this._currentTrackIndex + 1) % this._tracks.length;
    }

    this.play(nextIndex);
  }

  skipBack() {
    if (this._tracks.length === 0) return;

    // If more than 3 seconds in, restart current track
    if (this._audio.currentTime > 3) {
      this._audio.currentTime = 0;
      return;
    }

    let prevIndex;
    if (this._shuffleEnabled && this._shuffleEngine) {
      const currentPos = this._shuffleEngine.getPositionOf(this._currentTrackIndex);
      const prevPos = currentPos - 1;
      if (prevPos < 0) {
        prevIndex = this._shuffleEngine.getTrackAt(this._shuffleEngine.getLength() - 1);
      } else {
        prevIndex = this._shuffleEngine.getTrackAt(prevPos);
      }
    } else {
      prevIndex = this._currentTrackIndex - 1;
      if (prevIndex < 0) prevIndex = this._tracks.length - 1;
    }

    this.play(prevIndex);
  }

  seekTo(fraction) {
    if (!this._audio.duration) return;
    this._audio.currentTime = fraction * this._audio.duration;
  }

  // === VOLUME ===

  setVolume(level) {
    this._volume = Math.max(0, Math.min(1, level));
    this._applyVolume();
    this._emit('volumeChange', { volume: this._volume, muted: this._muted });
    this._persistState();
  }

  setMute(muted) {
    this._muted = muted;
    this._applyVolume();
    this._emit('volumeChange', { volume: this._volume, muted: this._muted });
  }

  // === MODE CONTROLS ===

  setMode(mode) {
    this._stateMachine.setMode(mode);
    this._emit('modeChange', { mode });
    this._persistState();
  }

  setShuffle(enabled) {
    this._shuffleEnabled = enabled;
    if (enabled && !this._shuffleEngine) {
      this._shuffleEngine = new ShuffleEngine(this._tracks.length);
    } else if (enabled && this._shuffleEngine) {
      this._shuffleEngine.reshuffle();
    }
    this._emit('shuffleChange', { enabled });
    this._persistState();
  }

  // === STATE QUERIES ===

  getState() {
    return {
      status: this._status,
      currentTrackIndex: this._currentTrackIndex,
      selectedTrackIndex: this._selectedTrackIndex,
      mode: this._stateMachine.getMode(),
      shuffleEnabled: this._shuffleEnabled,
      volume: this._volume,
      muted: this._muted,
    };
  }

  getCurrentTrack() {
    if (this._currentTrackIndex < 0) return null;
    return this._tracks[this._currentTrackIndex];
  }

  getProgress() {
    return {
      elapsed: this._audio.currentTime || 0,
      duration: this._audio.duration || 0,
      fraction: this._audio.duration ? this._audio.currentTime / this._audio.duration : 0,
    };
  }

  /**
   * Get the audio pipeline instance (for VU visualizer access).
   * @returns {AudioPipeline}
   */
  getAudioPipeline() {
    return this._audioPipeline;
  }

  setSelectedIndex(index) {
    this._selectedTrackIndex = index;
  }

  // === EVENTS ===

  on(event, handler) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(handler);
  }

  _emit(event, data) {
    const handlers = this._listeners[event];
    if (handlers) {
      handlers.forEach((h) => h(data));
    }
  }

  // === LIFECYCLE ===

  destroy() {
    this._audio.pause();
    this._audio.src = '';
    this._removeAudioEvents();
    this._cancelPrefetch();
    this._clearNormalizationTimer();
    this._audioPipeline.destroy();
    this._listeners = {};
  }

  // === PRIVATE ===

  _setupAudioEvents() {
    const handlers = {
      loadstart: () => {
        this._status = 'buffering';
        this._emit('bufferingStart');
      },
      canplay: () => {
        this._emit('bufferingEnd');
      },
      playing: () => {
        this._status = 'playing';
        this._emit('play');
      },
      waiting: () => {
        this._emit('bufferingStart');
      },
      timeupdate: () => {
        this._emit('progress', this.getProgress());
        this._checkPrefetch();
      },
      ended: () => {
        this._clearNormalizationTimer();
        const action = this._stateMachine.onTrackEnd(
          this._currentTrackIndex,
          this._tracks.length,
          this._shuffleEnabled ? this._shuffleEngine : undefined
        );
        if (action.action === 'play') {
          this.play(action.index);
        } else {
          this._status = 'idle';
          this._emit('ended');
        }
      },
      error: () => {
        this._handleError();
      },
      durationchange: () => {
        this._emit('progress', this.getProgress());
      },
    };

    this._boundHandlers = handlers;
    Object.entries(handlers).forEach(([event, handler]) => {
      this._audio.addEventListener(event, handler);
    });
  }

  _removeAudioEvents() {
    Object.entries(this._boundHandlers).forEach(([event, handler]) => {
      this._audio.removeEventListener(event, handler);
    });
  }

  _handleError() {
    this._status = 'error';
    this._emit('error', { index: this._currentTrackIndex });

    // Skip to next track
    const nextIndex = (this._currentTrackIndex + 1) % this._tracks.length;
    if (nextIndex !== this._currentTrackIndex) {
      setTimeout(() => this.play(nextIndex), 500);
    } else {
      // Only one track and it failed
      this._status = 'idle';
    }
  }

  _applyVolume() {
    const effectiveVolume = this._muted ? 0 : this._volume;
    if (this._audioPipeline.isWebAudioAvailable()) {
      this._audioPipeline.setVolume(effectiveVolume);
    } else {
      this._audio.volume = effectiveVolume;
    }
  }

  _schedulePrefetch() {
    this._cancelPrefetch();
  }

  _checkPrefetch() {
    // Prefetch next track at 75% progress
    if (!this._prefetchAudio && this._audio.duration) {
      const progress = this._audio.currentTime / this._audio.duration;
      if (progress >= 0.75) {
        this._prefetchNext();
      }
    }
  }

  _prefetchNext() {
    let nextIndex;
    if (this._shuffleEnabled && this._shuffleEngine) {
      const pos = this._shuffleEngine.getPositionOf(this._currentTrackIndex);
      if (pos + 1 < this._shuffleEngine.getLength()) {
        nextIndex = this._shuffleEngine.getTrackAt(pos + 1);
      }
    } else {
      nextIndex = this._currentTrackIndex + 1;
      if (nextIndex >= this._tracks.length) nextIndex = 0;
    }

    if (nextIndex !== undefined && nextIndex !== this._currentTrackIndex) {
      this._prefetchAudio = new Audio();
      this._prefetchAudio.preload = 'metadata';
      this._prefetchAudio.src = this._tracks[nextIndex].path;
    }
  }

  _cancelPrefetch() {
    if (this._prefetchAudio) {
      this._prefetchAudio.src = '';
      this._prefetchAudio = null;
    }
  }

  _clearNormalizationTimer() {
    if (this._normalizationTimeout) {
      clearTimeout(this._normalizationTimeout);
      this._normalizationTimeout = null;
    }
  }

  _persistState() {
    const track = this.getCurrentTrack();
    this._persistence.save({
      lastTrack: track ? track.filename : null,
      volume: this._volume,
      mode: this._stateMachine.getMode(),
      shuffleEnabled: this._shuffleEnabled,
    });
  }

  _restoreState() {
    const state = this._persistence.load();
    if (!state) return;

    this._volume = state.volume;
    this._stateMachine.setMode(state.mode);
    this._shuffleEnabled = state.shuffleEnabled;

    if (this._shuffleEnabled && this._tracks.length > 0) {
      this._shuffleEngine = new ShuffleEngine(this._tracks.length);
    }

    // Find last track by filename
    if (state.lastTrack) {
      const idx = this._tracks.findIndex((t) => t.filename === state.lastTrack);
      if (idx >= 0) {
        this._selectedTrackIndex = idx;
      }
    }
  }
}

/**
 * Audio Pipeline
 * Manages the audio graph: HTMLAudioElement → Web Audio API GainNode → destination.
 * Falls back to plain HTMLAudioElement if Web Audio API is unavailable.
 *
 * Implements peak normalization:
 *   - Measures peak amplitude from first few seconds of audio
 *   - Calculates targetGain = referenceLevel / measuredPeak
 *   - Caches gain values per filename in memory
 */

const REFERENCE_LEVEL = 0.8;

export class AudioPipeline {
  constructor() {
    this._context = null;
    this._gainNode = null;
    this._sourceNode = null;
    this._analyser = null;
    this._webAudioAvailable = false;
    this._gainCache = new Map(); // filename → gain value
    this._currentVolume = 1.0;
    this._currentGain = 1.0;

    this._initWebAudio();
  }

  _initWebAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this._context = new AudioCtx();
        this._gainNode = this._context.createGain();
        this._analyser = this._context.createAnalyser();
        this._analyser.fftSize = 2048;
        this._gainNode.connect(this._context.destination);
        this._webAudioAvailable = true;
      }
    } catch (e) {
      this._webAudioAvailable = false;
    }
  }

  /**
   * Connect an HTMLAudioElement to the Web Audio graph.
   * @param {HTMLAudioElement} audioElement
   */
  connect(audioElement) {
    if (!this._webAudioAvailable || !this._context) return;

    // Resume context if suspended (required after user gesture)
    if (this._context.state === 'suspended') {
      this._context.resume();
    }

    // Disconnect previous source if any
    if (this._sourceNode) {
      try {
        this._sourceNode.disconnect();
      } catch (e) {
        // ignore
      }
    }

    try {
      this._sourceNode = this._context.createMediaElementSource(audioElement);
      this._sourceNode.connect(this._analyser);
      this._analyser.connect(this._gainNode);
    } catch (e) {
      // If element already connected, just update gain
    }
  }

  /**
   * Set normalization gain (0.0 - 2.0).
   * @param {number} value
   */
  setGain(value) {
    this._currentGain = value;
    if (this._gainNode) {
      this._gainNode.gain.value = value * this._currentVolume;
    }
  }

  /**
   * Set user volume (0.0 - 1.0).
   * @param {number} value
   */
  setVolume(value) {
    this._currentVolume = value;
    if (this._gainNode) {
      this._gainNode.gain.value = this._currentGain * value;
    }
  }

  /**
   * Get cached gain for a filename, or null if not yet measured.
   * @param {string} filename
   * @returns {number|null}
   */
  getCachedGain(filename) {
    return this._gainCache.has(filename) ? this._gainCache.get(filename) : null;
  }

  /**
   * Measure peak amplitude and cache the normalization gain.
   * Should be called after a few seconds of playback.
   * @param {string} filename
   */
  measureAndCacheGain(filename) {
    if (!this._analyser || this._gainCache.has(filename)) return;

    const dataArray = new Float32Array(this._analyser.fftSize);
    this._analyser.getFloatTimeDomainData(dataArray);

    let peak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const abs = Math.abs(dataArray[i]);
      if (abs > peak) peak = abs;
    }

    // Avoid division by zero; if peak is very low, use gain of 1.0
    const gain = peak > 0.01 ? REFERENCE_LEVEL / peak : 1.0;
    // Clamp gain to reasonable range
    const clampedGain = Math.min(Math.max(gain, 0.5), 2.0);
    this._gainCache.set(filename, clampedGain);
    this.setGain(clampedGain);
  }

  /**
   * @returns {AudioContext|null}
   */
  getContext() {
    return this._context;
  }

  /**
   * @returns {boolean}
   */
  isWebAudioAvailable() {
    return this._webAudioAvailable;
  }

  /**
   * Close AudioContext and disconnect all nodes.
   */
  destroy() {
    if (this._sourceNode) {
      try { this._sourceNode.disconnect(); } catch (e) {}
    }
    if (this._analyser) {
      try { this._analyser.disconnect(); } catch (e) {}
    }
    if (this._gainNode) {
      try { this._gainNode.disconnect(); } catch (e) {}
    }
    if (this._context && this._context.state !== 'closed') {
      this._context.close().catch(() => {});
    }
    this._sourceNode = null;
    this._analyser = null;
    this._gainNode = null;
    this._context = null;
    this._webAudioAvailable = false;
  }
}

/**
 * App Initializer
 * Entry point. Orchestrates startup sequence.
 */

// When used in build (concatenated), these are all in the same IIFE scope.
// During development with ES modules, they would be imported.

async function initApp() {
  const ui = getUIElements();

  // Show loading state
  if (ui.loadingOverlay) {
    ui.loadingOverlay.classList.add('visible');
    ui.loadingOverlay.setAttribute('aria-hidden', 'false');
  }

  // Fallback: if tracks.js failed to load (e.g., file:// CORS block),
  // default to empty array so the app shows "Empty Library" gracefully
  if (typeof window.TRACKS === 'undefined') {
    window.TRACKS = [];
  }

  // Check for TRACKS global
  if (!Array.isArray(window.TRACKS)) {
    showFatalError(ui, 'Music library could not be loaded');
    return;
  }

  if (window.TRACKS.length === 0) {
    hidLoading(ui);
    showEmptyLibrary(ui);
    return;
  }

  // Parse URL query parameters
  const params = parseQueryParams();

  // Process manifest (ID3 + title derivation + sort)
  let tracks;
  try {
    tracks = await processManifest(window.TRACKS);
  } catch (e) {
    showFatalError(ui, 'Failed to process music library');
    return;
  }

  // Apply game prefix filter
  if (params.game) {
    tracks = filterByGamePrefix(tracks, params.game);
  }

  // Store references
  const state = {
    masterPlaylist: tracks,
    filteredPlaylist: tracks,
  };

  // Create controllers
  const songListRenderer = new SongListRenderer(
    ui.songListContainer,
    ui.srAnnouncements,
    (index) => {
      const s = playerEngine.getState();
      if (s.status === 'idle' || s.status === 'error') {
        // Starting from stopped — swing arm first
        if (stylusArm && !stylusArm.classList.contains('playing')) {
          stylusArm.classList.add('playing');
          setTimeout(() => playerEngine.play(index), 800);
        } else {
          playerEngine.play(index);
        }
      } else {
        // Already playing/paused — just switch tracks, arm stays on
        playerEngine.play(index);
      }
    }
  );

  const playerEngine = new PlayerEngine(tracks, { gainNormalization: true });
  const animController = new AnimationController();
  const uiController = new UIController(ui);

  // Set up animation elements
  const bubbleElements = [];
  document.querySelectorAll('.bubble').forEach((el) => bubbleElements.push(el));
  animController.setElements(ui.vinylRecord, bubbleElements);

  // Stylus arm reference
  const stylusArm = document.getElementById('stylus-arm');

  // Set up VU Visualizer
  const vuCanvas = document.getElementById('vu-canvas');
  let vuAnimationId = null;
  let vuAnalyser = null;

  function initVUVisualizer() {
    const pipeline = playerEngine.getAudioPipeline();
    if (!pipeline || !pipeline.isWebAudioAvailable()) return;

    const ctx = pipeline.getContext();
    if (!ctx) return;

    vuAnalyser = ctx.createAnalyser();
    vuAnalyser.fftSize = 256;
    vuAnalyser.smoothingTimeConstant = 0.75;

    try {
      const gainNode = pipeline._gainNode;
      if (gainNode) {
        gainNode.connect(vuAnalyser);
      }
    } catch (e) {
      // Fallback: VU won't work but app continues
    }
  }

  function startVU() {
    if (!vuCanvas || !vuAnalyser) return;
    vuCanvas.classList.add('active');
    drawVU();
  }

  function stopVU() {
    if (vuCanvas) vuCanvas.classList.remove('active');
    if (vuAnimationId) {
      cancelAnimationFrame(vuAnimationId);
      vuAnimationId = null;
    }
  }

  function drawVU() {
    if (!vuAnalyser || !vuCanvas) return;
    const canvasCtx = vuCanvas.getContext('2d');
    if (!canvasCtx) return;

    const w = vuCanvas.clientWidth;
    const h = vuCanvas.clientHeight;

    if (vuCanvas.width !== w || vuCanvas.height !== h) {
      vuCanvas.width = w;
      vuCanvas.height = h;
    }

    // Use time-domain data for even distribution across bars
    const bufferLength = vuAnalyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    vuAnalyser.getByteTimeDomainData(dataArray);

    canvasCtx.clearRect(0, 0, w, h);

    const barCount = 32;
    const barWidth = w / barCount;
    const maxBarHeight = h * 0.75;
    const samplesPerBar = Math.floor(bufferLength / barCount);

    // Initialize smoothed values on first call
    if (!drawVU._smoothed) {
      drawVU._smoothed = new Float32Array(barCount).fill(0.15);
    }
    const smoothed = drawVU._smoothed;
    const smoothing = 0.82; // Higher = smoother (0-1)

    // Color gradient: red → orange → green → cyan → purple
    function getBarColor(barIndex, intensity) {
      const ratio = barIndex / barCount;
      if (ratio < 0.2) {
        return { top: `rgba(255,50,50,${0.5 + intensity * 0.4})`, bottom: 'rgba(180,20,20,0.1)' };
      } else if (ratio < 0.4) {
        return { top: `rgba(255,140,0,${0.5 + intensity * 0.4})`, bottom: 'rgba(200,100,0,0.1)' };
      } else if (ratio < 0.6) {
        return { top: `rgba(57,255,20,${0.5 + intensity * 0.4})`, bottom: 'rgba(30,150,10,0.1)' };
      } else if (ratio < 0.8) {
        return { top: `rgba(0,191,255,${0.5 + intensity * 0.4})`, bottom: 'rgba(0,100,180,0.1)' };
      } else {
        return { top: `rgba(155,89,182,${0.5 + intensity * 0.4})`, bottom: 'rgba(100,40,130,0.1)' };
      }
    }

    for (let i = 0; i < barCount; i++) {
      // RMS amplitude for this bar's chunk
      const startSample = i * samplesPerBar;
      let sumSquares = 0;
      for (let s = startSample; s < startSample + samplesPerBar && s < bufferLength; s++) {
        const normalized = (dataArray[s] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / samplesPerBar);
      const target = Math.min(1.0, rms * 3.5);

      // Smooth: rise fast, fall slow
      if (target > smoothed[i]) {
        smoothed[i] = smoothed[i] * 0.4 + target * 0.6;
      } else {
        smoothed[i] = smoothed[i] * smoothing + target * (1 - smoothing);
      }

      const intensity = smoothed[i];
      const value = intensity * 0.6 + 0.15;
      const barHeight = value * maxBarHeight;
      const x = i * barWidth;
      const y = h - barHeight;

      const colors = getBarColor(i, intensity);
      const gradient = canvasCtx.createLinearGradient(x, y, x, h);
      gradient.addColorStop(0, colors.top);
      gradient.addColorStop(1, colors.bottom);

      canvasCtx.fillStyle = gradient;
      canvasCtx.fillRect(x + 1, y, barWidth - 2, barHeight);

      if (intensity > 0.2) {
        canvasCtx.fillStyle = colors.top.replace(/[\d.]+\)$/, '0.9)');
        canvasCtx.fillRect(x + 1, y - 2, barWidth - 2, 2);
      }
    }

    vuAnimationId = requestAnimationFrame(drawVU);
  }

  // Visibility controller
  const visController = new VisibilityController({
    onHidden: () => {
      animController.pause();
    },
    onVisible: () => {
      animController.resume();
      // Resync progress bar
      const progress = playerEngine.getProgress();
      uiController.updateProgress(progress.elapsed, progress.duration);
    },
  });

  // Render song list
  songListRenderer.render(tracks);

  // Generate bubble elements
  generateBubbles();

  // Restore persisted state
  const playerState = playerEngine.getState();
  uiController.setLoopButtonState(playerState.mode);
  uiController.setShuffleButtonState(playerState.shuffleEnabled);
  if (ui.volumeSlider) {
    ui.volumeSlider.value = String(playerState.volume * 100);
  }

  // If ?track= param, auto-select
  if (params.track) {
    const trackIdx = tracks.findIndex((t) => t.filename === params.track);
    if (trackIdx >= 0) {
      songListRenderer.setSelectedTrack(trackIdx);
      playerEngine.setSelectedIndex(trackIdx);
    }
  } else if (playerState.selectedTrackIndex >= 0) {
    songListRenderer.setSelectedTrack(playerState.selectedTrackIndex);
  }

  // Wire up Player Engine events
  let isPlayingFromStop = false; // Track if we're starting from a stopped state

  playerEngine.on('play', () => {
    animController.setVinylSpinning(true);
    uiController.setPlayButtonState(true);
    if (stylusArm && !stylusArm.classList.contains('playing')) {
      stylusArm.classList.add('playing');
    }
    if (!vuAnalyser) initVUVisualizer();
    startVU();
    // Toggle play/pause SVG icons
    const playIcon = ui.playPauseBtn.querySelector('.icon-play');
    const pauseIcon = ui.playPauseBtn.querySelector('.icon-pause');
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = 'block';
  });

  playerEngine.on('pause', () => {
    animController.setVinylSpinning(false);
    uiController.setPlayButtonState(false);
    stopVU();
    // Toggle play/pause SVG icons
    const playIcon = ui.playPauseBtn.querySelector('.icon-play');
    const pauseIcon = ui.playPauseBtn.querySelector('.icon-pause');
    if (playIcon) playIcon.style.display = 'block';
    if (pauseIcon) pauseIcon.style.display = 'none';
  });

  playerEngine.on('stop', () => {
    animController.setVinylSpinning(false);
    uiController.setPlayButtonState(false);
    uiController.updateProgress(0, 0);
    if (stylusArm) stylusArm.classList.remove('playing');
    stopVU();
    // Toggle play/pause SVG icons
    const playIcon = ui.playPauseBtn.querySelector('.icon-play');
    const pauseIcon = ui.playPauseBtn.querySelector('.icon-pause');
    if (playIcon) playIcon.style.display = 'block';
    if (pauseIcon) pauseIcon.style.display = 'none';
  });

  playerEngine.on('trackChange', (data) => {
    songListRenderer.setActiveTrack(data.index);
  });

  playerEngine.on('progress', (data) => {
    uiController.updateProgress(data.elapsed, data.duration);
  });

  playerEngine.on('bufferingStart', () => {
    uiController.showBuffering();
  });

  playerEngine.on('bufferingEnd', () => {
    uiController.hideBuffering();
  });

  playerEngine.on('error', () => {
    uiController.showError('Track unavailable, skipping...');
  });

  playerEngine.on('modeChange', (data) => {
    uiController.setLoopButtonState(data.mode);
  });

  playerEngine.on('shuffleChange', (data) => {
    uiController.setShuffleButtonState(data.enabled);
  });

  // Wire up transport controls
  ui.playPauseBtn.addEventListener('click', () => {
    const s = playerEngine.getState();
    if (s.status === 'playing') {
      playerEngine.pause();
    } else if (s.status === 'paused') {
      playerEngine.resume();
    } else {
      // Starting from stopped state — swing arm first, then play
      const idx = s.selectedTrackIndex >= 0 ? s.selectedTrackIndex : 0;
      if (stylusArm && !stylusArm.classList.contains('playing')) {
        stylusArm.classList.add('playing');
        // Wait for arm animation to complete (0.8s transition) before starting audio
        setTimeout(() => {
          playerEngine.play(idx);
        }, 800);
      } else {
        playerEngine.play(idx);
      }
    }
  });

  ui.skipForwardBtn.addEventListener('click', () => playerEngine.skipForward());
  ui.skipBackBtn.addEventListener('click', () => playerEngine.skipBack());

  // Loop button cycles: play-through → loop-all → loop-one → play-through
  const modes = ['play-through', 'loop-all', 'loop-one'];
  ui.loopBtn.addEventListener('click', () => {
    const current = playerEngine.getState().mode;
    const idx = modes.indexOf(current);
    const next = modes[(idx + 1) % modes.length];
    playerEngine.setMode(next);
  });

  // Shuffle toggle
  ui.shuffleBtn.addEventListener('click', () => {
    const s = playerEngine.getState();
    playerEngine.setShuffle(!s.shuffleEnabled);
  });

  // Volume slider
  ui.volumeSlider.addEventListener('input', (e) => {
    playerEngine.setVolume(parseInt(e.target.value) / 100);
  });

  // Mute button
  ui.muteBtn.addEventListener('click', () => {
    const s = playerEngine.getState();
    playerEngine.setMute(!s.muted);
    const volIcon = ui.muteBtn.querySelector('.icon-vol');
    const mutedIcon = ui.muteBtn.querySelector('.icon-muted');
    if (!s.muted) {
      // Now muting
      if (volIcon) volIcon.style.display = 'none';
      if (mutedIcon) mutedIcon.style.display = 'block';
      ui.muteBtn.classList.add('muted');
    } else {
      // Now unmuting
      if (volIcon) volIcon.style.display = 'block';
      if (mutedIcon) mutedIcon.style.display = 'none';
      ui.muteBtn.classList.remove('muted');
    }
  });

  // Progress bar scrub
  let isScrubbing = false;
  const progressBar = ui.progressBar;

  function handleScrub(e) {
    const rect = progressBar.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    playerEngine.seekTo(fraction);
  }

  progressBar.addEventListener('pointerdown', (e) => {
    isScrubbing = true;
    handleScrub(e);
    progressBar.setPointerCapture(e.pointerId);
  });

  progressBar.addEventListener('pointermove', (e) => {
    if (isScrubbing) handleScrub(e);
  });

  progressBar.addEventListener('pointerup', () => {
    isScrubbing = false;
  });

  // Set up keyboard navigation
  setupKeyboardNavigation(ui, playerEngine, songListRenderer, tracks);

  // Set up share button
  const shareBtn = document.getElementById('btn-share');
  if (shareBtn && (isShareSupported() || isClipboardSupported())) {
    shareBtn.removeAttribute('hidden');
    shareBtn.addEventListener('click', () => {
      const currentTrack = playerEngine.getCurrentTrack();
      shareTrack({
        trackTitle: currentTrack ? currentTrack.title : null,
        trackFilename: currentTrack ? currentTrack.filename : null,
        onSuccess: (method) => {
          const msg = method === 'copied' ? 'Link copied to clipboard' : 'Shared!';
          uiController.showError(msg, 'info');
        },
        onError: () => {
          uiController.showError('Could not share', 'error');
        },
      });
    });
  }

  // Hide loading
  hidLoading(ui);
}

function getUIElements() {
  return {
    songListContainer: document.getElementById('song-list'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),
    elapsedTime: document.getElementById('elapsed-time'),
    totalTime: document.getElementById('total-time'),
    nowPlayingTitle: null,
    vinylRecord: document.getElementById('vinyl'),
    playPauseBtn: document.getElementById('btn-play'),
    skipForwardBtn: document.getElementById('btn-next'),
    skipBackBtn: document.getElementById('btn-prev'),
    volumeSlider: document.getElementById('volume-slider'),
    muteBtn: document.getElementById('btn-mute'),
    loopBtn: document.getElementById('btn-loop'),
    shuffleBtn: document.getElementById('btn-shuffle'),
    loadingOverlay: document.getElementById('loading-overlay'),
    toastContainer: document.getElementById('toast'),
    srAnnouncements: document.getElementById('sr-announcements'),
  };
}

function showFatalError(ui, message) {
  hidLoading(ui);
  if (ui.songListContainer) {
    ui.songListContainer.innerHTML = '';
    const msg = document.createElement('div');
    msg.classList.add('empty-library');
    msg.textContent = message;
    msg.setAttribute('role', 'alert');
    ui.songListContainer.appendChild(msg);
  }
}

function showEmptyLibrary(ui) {
  if (ui.songListContainer) {
    ui.songListContainer.innerHTML = '';
    const msg = document.createElement('div');
    msg.classList.add('empty-library');
    msg.textContent = 'Empty Library — no tracks available';
    msg.setAttribute('role', 'status');
    ui.songListContainer.appendChild(msg);
  }
}

function hidLoading(ui) {
  if (ui.loadingOverlay) {
    ui.loadingOverlay.classList.remove('visible');
    ui.loadingOverlay.setAttribute('aria-hidden', 'true');
  }
}

function generateBubbles() {
  const colors = ['#ff8c00', '#ffaa00', '#ff1493', '#00bfff', '#39ff14', '#9b59b6'];
  const container = document.getElementById('bubble-container');
  if (!container) return;

  // Left side bubbles — travel full path from bottom to badge
  for (let i = 0; i < 18; i++) {
    const bubble = document.createElement('div');
    bubble.classList.add('bubble', 'bubble-path-left');
    const size = 3 + Math.random() * 5;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const duration = 25 + Math.random() * 15;
    const delay = Math.random() * duration;

    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.background = color;
    bubble.style.boxShadow = `0 0 ${size}px ${color}66`;
    bubble.style.animationDuration = `${duration}s`;
    bubble.style.animationDelay = `-${delay}s`;

    container.appendChild(bubble);
  }

  // Right side bubbles
  for (let i = 0; i < 18; i++) {
    const bubble = document.createElement('div');
    bubble.classList.add('bubble', 'bubble-path-right');
    const size = 3 + Math.random() * 5;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const duration = 25 + Math.random() * 15;
    const delay = Math.random() * duration;

    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.background = color;
    bubble.style.boxShadow = `0 0 ${size}px ${color}66`;
    bubble.style.animationDuration = `${duration}s`;
    bubble.style.animationDelay = `-${delay}s`;

    container.appendChild(bubble);
  }
}

// Boot on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initApp);

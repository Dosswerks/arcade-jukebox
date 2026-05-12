# Dosswerks Arcade Jukebox

A standalone HTML5 music player styled as a classic arcade jukebox. Part of the [Dosswerks Arcade](https://dosswerks.github.io/arcade/).

**Live:** https://dosswerks.github.io/arcade-jukebox/

## Features

- Zero-dependency, single-file deployment (inline CSS + JS)
- Animated bubble tube frame, spinning vinyl record, and VU visualizer
- ID3v2 tag parsing for track titles (HTTPS only, filename fallback)
- Shuffle (Fisher-Yates), loop-one, loop-all, and play-through modes
- Web Audio API gain normalization
- Deep linking via `?track=` and `?game=` query parameters
- Playlist support via `?playlist=` parameter
- Social sharing (Web Share API with clipboard fallback)
- Keyboard navigation and screen reader announcements
- Persists volume, mode, and shuffle state across sessions (localStorage)
- Mobile-first, safe-area aware, works on `file://` and `https://`
- Respects `prefers-reduced-motion`

## Project Structure

```
dosswerks-jukebox/
├── index.html          # Built output (single deployable file)
├── tracks.js           # Track/playlist manifest (auto-generated)
├── assets/             # MP3 audio files
├── fonts/              # NeoNeon woff2 font
├── src/                # Source modules (development)
│   ├── index.html      # HTML template
│   ├── styles.css      # All styles
│   ├── app-initializer.js
│   ├── audio-pipeline.js
│   ├── player-engine.js
│   ├── social-sharing.js
│   └── ...             # Other modules
├── scripts/
│   └── generate-tracks.js  # Regenerates tracks.js from assets/
├── tests/              # Unit, integration, and property tests
├── build.sh            # Concatenates src/ into index.html
├── package.json
└── vitest.config.js
```

## Getting Started

### Prerequisites

- Node.js (for tests and track generation)
- No build tools required for deployment

### Generate Track Manifest

```bash
node scripts/generate-tracks.js
```

### Build

```bash
bash build.sh
```

This concatenates all source modules into a single `index.html` with inline CSS and JS.

### Run Tests

```bash
npm test
```

### Local Development

Open `index.html` directly in a browser (`file://` protocol works). ID3 title parsing is skipped on `file://` — titles fall back to filename derivation.

For full functionality (ID3 parsing, Web Share API), serve over HTTPS or use a local server:

```bash
npx serve .
```

## Deep Linking

| Parameter | Description | Example |
|-----------|-------------|---------|
| `?track=` | Auto-select a track by filename | `?track=Dagon.mp3` |
| `?game=`  | Filter tracks by game prefix | `?game=Innsmouth%20Invaders` |
| `?playlist=` | Load a named playlist | `?playlist=default` |

## License

Private — Dosswerks

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Vite-powered browser application that converts webcam hand gestures into a DJ deck controller for Native Instruments "The Deep" stems. Uses MediaPipe HandLandmarker for vision and Web Audio API + Three.js for audio/visuals.

## Development Commands

```bash
npm install              # Install dependencies
npm run dev             # Start Vite dev server (localhost:5173)
npm run build           # Production build
npm run preview         # Preview production build (localhost:4173)
npm run inspect -- http://localhost:5173/  # Playwright screenshot automation
```

**Camera access requires `localhost`** (browser security restriction).

## Architecture

Single-file architecture in `src/app.js` with three core classes:

### AudioDeck
- Web Audio API wrapper for stem-based audio playback
- Loads 4 stem files (drums, bass, chords, arp) from `audio/the-deep/`
- All stems cued to a shared hot loop section (124.0s - 175.1s) for immediate layer entry
- Supports custom stem file replacement via layer panel UI
- Real-time level analysis via `AnalyserNode` for visualization

### VisualDeck
- Three.js scene with torus rings and spectral bars
- Renders to `#visualizer` canvas with additive blending
- Audio-reactive: bars lift with track levels, rings pulse with layer count
- Separate `renderBackdrop()` for 2D canvas background wave effect

### GestureEngine
- MediaPipe HandLandmarker with local model files (no CDN dependency)
- Model files: `public/mediapipe/models/hand_landmarker.task` + WASM files
- Capped scan rate (~18 FPS) with adaptive interval based on processing cost
- Small state machine: gesture changes commit only after ~110ms of stability
- Hands disappearing holds current layer state (doesn't auto-stop music)

## Gesture System

- **1-4 fingers**: Lock incremental layers (drums → drums+bass → ... → all 4 stems)
- **5 fingers**: Lock all stems + DJ boost mode
- **Two-index intent**: Distance between index fingers controls master volume (tolerates false positives from thumb/middle)
- **Rubbing hands close together**: Scratch/stutter effect
- **No hands/fewer fingers**: Keep last locked layer state
- **Palm pull fist**: Open palm → pull away → make fist to stop/clear all layers

## MediaPipe Assets

Model files are stored locally in `public/mediapipe/`:
- `models/hand_landmarker.task` - Model weights
- `wasm/` - WebAssembly binaries

**Do not move or rename these** - the app expects them at this exact path for offline-first operation.

## Audio Assets

Stem files in `audio/the-deep/`:
- `01-drums.m4a`
- `02-bass.m4a`
- `03-chords.m4a`
- `04-arp.m4a`

All tracks are cued to `hotLoop = { start: 124.0, end: 175.1 }` seconds.

## Key State Object

The `state` object in `src/app.js` is the single source of truth:
- `layerCount`: Current locked layer count (0-5)
- `masterVolume`: Actual master volume (lerped toward targetVolume)
- `targetVolume`: Volume target from two-index gesture
- `scratchEnergy`: 0-1, from rubbing gesture
- `boostEnergy`: 0-1, transitions in when layerCount >= 5
- `hands`: Array of processed hand objects
- `rawHands`: Number of detected hands

## Development Notes

- The app requires HTTPS or `localhost` for camera access
- MediaPipe GPU delegate is tried first, falls back to CPU on failure
- The Playwright inspect script uses a specific Chrome path - adjust for your system
- First click starts both camera and Web Audio (browser autoplay policy)

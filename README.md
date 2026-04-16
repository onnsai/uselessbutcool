# uselessbutcool

A Node/Vite browser project that turns webcam hand gestures into a DJ deck for Native Instruments `TRANSISTOR PUNCH - The Deep`.

## Run

Install dependencies once:

```bash
npm install
```

Start the local Vite server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Camera access works on `localhost`. The first click starts both the webcam and Web Audio playback.

## Gesture Engine

The app uses `@mediapipe/tasks-vision` with the MediaPipe HandLandmarker model stored locally:

```text
public/mediapipe/models/hand_landmarker.task
public/mediapipe/wasm/
```

Hand tracking runs at a capped scan rate, then a small state machine commits gesture changes only after they stay stable for a short moment. If hands disappear, the current music layer is held instead of stopping.

## Audio

Native Instruments provides `The Deep` inside the free Stems Tracks bundle:

https://www.native-instruments.com/en/specials/stems-for-all/free-stems-tracks/

The `.stem.mp4` contains one master/mix track plus four real stems. This project uses the four real stems and treats the fifth finger as a DJ FX boost.
The stems are cued to a shared hot loop section so every layer enters immediately instead of waiting through the original arrangement intro.

```text
audio/the-deep/01-drums.m4a
audio/the-deep/02-bass.m4a
audio/the-deep/03-chords.m4a
audio/the-deep/04-arp.m4a
```

## Controls

- 1 finger: lock drums
- 2 fingers: lock drums + bass
- 3 fingers: lock drums + bass + chords
- 4 fingers: lock all real stems
- 5 fingers: lock all stems + DJ boost
- Two-index intent: distance controls master volume; small thumb/middle false positives are tolerated
- Rubbing hands close together: scratch / stutter
- No hands or fewer fingers: keep the last locked layer state
- Open one palm near the camera, pull it away, then make a fist: stop music / clear all locked layers

## Face FX

- Glasses are available as a toggle and start off.
- MediaPipe eye and iris landmarks are retained for better glasses anchoring.
- Laser Eyes is disabled for now because the gaze direction is not stable enough for the main experience.

## Check

```bash
npm run build
npm run inspect -- http://localhost:5173/
```

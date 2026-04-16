# uselessbutcool

`uselessbutcool` is a no-backend browser experiment that turns webcam hand gestures into a DJ deck, neon HUD, and gesture-driven 3D avatar scene.

`uselessbutcool` 是一个纯前端实验项目：用电脑摄像头识别手势，把手势变成 DJ 分轨控制、霓虹 HUD、透明摄像头叠加层，以及双手控制的 3D 模型舞台。

The goal is simple: cool, playful, visual, loud.

项目目标也很简单：cool，好看，好玩，好听。

## Features / 功能

- Webcam hand tracking with local MediaPipe Hands assets.
- Finger-count layer locking for a DJ stem deck.
- Dual-index volume control with a visible connection line.
- Hand rubbing scratch / stutter effect.
- Palm pull + fist stop gesture.
- Beat-reactive 3D visualizer and background.
- Transparent camera overlay with hand skeleton, gesture links, and debug labels.
- Optional face visor / cyber glasses effect, off by default.
- GLB avatar loaded from `public/3dmodel/just_a_girl.glb`.
- Two-open-hands avatar control mode.
- `MODEL POS` debug card showing model scale, position, rotation, camera distance, spread, and depth.

- 使用本地 MediaPipe Hands 资源进行摄像头手势识别。
- 通过手指数锁定 DJ 分轨层数。
- 双食指距离控制音量，并显示明显的连接线。
- 手搓手势触发 scratch / stutter 效果。
- 单手开掌后撤再握拳，用于停止音乐。
- 中央 3D 视觉和背景会跟随音乐、层数、手势能量变化。
- 摄像头区域显示透明手部骨架、手势连接线和调试标签。
- 可选的赛博眼镜 / visor 效果，默认关闭。
- 页面加载后会加载 `public/3dmodel/just_a_girl.glb` 3D 模型。
- 双手张开后进入 avatar 控制模式。
- `MODEL POS` 调试卡展示模型缩放、位置、旋转、镜头距离、双手距离和深度参数。

## Tech Stack / 技术栈

- Vite
- Three.js
- `@mediapipe/tasks-vision`
- Web Audio API
- Canvas 2D
- Vanilla JavaScript modules

No server is required beyond the local Vite dev server.

项目不需要后端，只需要 Vite 本地开发服务器。

## Run / 运行

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Camera access works on `localhost`. Click `Start Camera + Audio` to start webcam tracking and Web Audio playback.

摄像头权限在 `localhost` 下可用。打开页面后点击 `Start Camera + Audio`，会同时启动摄像头识别和音频播放。

## Gesture Controls / 手势控制

### Music Layers / 音乐层

- 1 finger: lock drums.
- 2 fingers: lock drums + bass.
- 3 fingers: lock drums + bass + chords.
- 4 fingers: lock all real stems.
- 5 fingers: lock all stems + DJ FX boost.
- If hands disappear or fewer fingers are shown, the last locked layer state is kept.

- 伸出 1 根手指：锁定鼓组。
- 伸出 2 根手指：锁定鼓组 + bass。
- 伸出 3 根手指：锁定鼓组 + bass + chords。
- 伸出 4 根手指：锁定所有真实分轨。
- 伸出 5 根手指：锁定所有分轨 + DJ FX boost。
- 手消失或手指数减少时，不会自动减少层数，会保留最后状态。

### Volume / 音量

- Two-index intent: when both hands show only index fingers, the distance controls master volume.
- The camera overlay draws a bright line between the two index tips.

- 双手都只伸出食指时，两个食指之间的距离控制总音量。
- 摄像头叠加层会在两个食指之间画出明显的音量线。

### Scratch / 打碟

- Rub both hands close together to engage scratch / stutter energy.

- 双手靠近并快速搓动时，会触发 scratch / stutter 的打碟效果。

### Stop / 停止音乐

- Open one palm near the camera, pull it away, then make a fist to clear all layers and stop the music.

- 单手全开手掌靠近摄像头，向后拉远后握拳，可以清空所有层并停止音乐。

### Avatar Control / 3D 模型控制

When both hands are open enough, the app enters avatar control mode:

- Scale is fixed at `5`.
- X is fixed at `-0.73`.
- Y is controlled by the average vertical screen position of both hands, from `-6.90` to `-5.29`.
- Z is controlled by the distance between both hands, from `-2` to `-0.75`.
- Rotation Y is controlled by left-hand/right-hand apparent size difference.
- Rotation Z is fixed at `-0.1`.
- Camera Z is fixed at `3`.

双手张开后会进入 3D 模型控制模式：

- 模型缩放固定为 `5`。
- X 固定为 `-0.73`。
- Y 由双手在屏幕中的平均高度控制，范围 `-6.90` 到 `-5.29`。
- Z 由双手距离控制，范围 `-2` 到 `-0.75`。
- Rotation Y 由左右手在画面中的大小差控制。左手更靠近屏幕时偏向 `3.14`，右手更靠近屏幕时偏向 `-3.14`。
- Rotation Z 固定为 `-0.1`。
- Camera Z 固定为 `3`。

These values live in `src/core/config.js` under `MODEL_CONFIG.render.gesture`.

这些数值集中放在 `src/core/config.js` 的 `MODEL_CONFIG.render.gesture` 中，方便继续调参。

## Audio Assets / 音频素材

The project currently uses Native Instruments `TRANSISTOR PUNCH - The Deep` stems.

当前项目使用 Native Instruments `TRANSISTOR PUNCH - The Deep` 的 stems。

Expected audio files:

```text
audio/the-deep/01-drums.m4a
audio/the-deep/02-bass.m4a
audio/the-deep/03-chords.m4a
audio/the-deep/04-arp.m4a
audio/the-deep/track-01-master-or-mix.m4a
```

The four real stems are cued to a shared hot loop so layers enter quickly instead of waiting through the original arrangement intro.

四个真实分轨会从共同的 hot loop 位置进入，避免原曲前奏太慢，手势加层会更直接。

## 3D Model / 3D 模型

The avatar is loaded from:

```text
public/3dmodel/just_a_girl.glb
```

The source copy is also kept at:

```text
3dmodel/just_a_girl.glb
```

网页运行时使用 `public/3dmodel/just_a_girl.glb`。根目录 `3dmodel/` 中保留了一份源文件副本。

## Local Vision Assets / 本地视觉模型

MediaPipe assets are stored locally so the app can run without fetching model files from a CDN:

```text
public/mediapipe/models/hand_landmarker.task
public/mediapipe/models/face_landmarker.task
public/mediapipe/wasm/
```

MediaPipe 资源保存在本地，避免运行时从 CDN 下载模型文件。

## Check / 检查

Build:

```bash
npm run build
```

Run the layout inspection script against a local dev server:

```bash
npm run dev
npm run inspect -- http://localhost:5173/
```

构建检查：

```bash
npm run build
```

启动本地服务后，可以用 inspect 脚本检查多分辨率布局：

```bash
npm run dev
npm run inspect -- http://localhost:5173/
```

## Notes / 注意事项

- `node_modules/`, `dist/`, screenshots, and `.DS_Store` are ignored by git.
- This repository contains local media/model assets, so clone size is larger than a minimal frontend project.
- The project is experimental and optimized for live visual interaction rather than production accessibility.
- Face glasses are optional and disabled by default.
- The `MODEL POS` panel is currently read-only. It displays runtime values only.

- `node_modules/`、`dist/`、截图目录和 `.DS_Store` 不进入 git。
- 仓库包含本地音频、MediaPipe 模型和 GLB 模型，所以体积会比普通前端项目大。
- 这是实验型交互项目，优先服务现场视觉体验，不是标准产品模板。
- 眼镜效果默认关闭。
- `MODEL POS` 当前是只读面板，只显示运行时模型状态，不显示编辑按钮和滑块。

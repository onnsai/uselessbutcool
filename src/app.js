import { elements } from "./core/dom.js";
import { state } from "./core/state.js";
import { lerp, clamp } from "./core/math.js";
import { pushLog } from "./core/log.js";
import { AudioDeck } from "./audio/AudioDeck.js";
import { captureStartupCameraClip } from "./camera/CaptureRecorder.js";
import { VisualDeck } from "./renderers/VisualDeck.js";
import { FaceVisorDeck } from "./renderers/FaceVisorDeck.js";
import { drawHands, resizeOverlay } from "./renderers/HandOverlay.js";
import { setupLayers, setupMeters, updateHud } from "./ui/hud.js";
import { toggleGlasses, updateFxButtons } from "./ui/fxControls.js";

const audioDeck = new AudioDeck();
const visualDeck = new VisualDeck();
const faceVisorDeck = new FaceVisorDeck();
let gestureEngine = null;
let gestureEnginePromise = null;

async function getGestureEngine() {
  if (gestureEngine) return gestureEngine;
  if (!gestureEnginePromise) {
    gestureEnginePromise = import("./vision/GestureEngine.js").then(({ GestureEngine }) => {
      gestureEngine = new GestureEngine();
      return gestureEngine;
    });
  }
  return gestureEnginePromise;
}

function animate(now = performance.now()) {
  const time = now / 1000;
  const previous = animate.previous ?? now;
  const dt = clamp((now - previous) / 1000, 0.001, 0.08);
  animate.previous = now;

  if (state.running && gestureEngine) gestureEngine.scan(now);

  state.boostEnergy = lerp(state.boostEnergy, state.layerCount >= 5 ? 1 : 0, 1 - Math.exp(-dt * 5));
  state.handEnergy = lerp(state.handEnergy, state.rawHands ? 1 : 0, 1 - Math.exp(-dt * 4));
  audioDeck.update(dt);
  visualDeck.render(time, audioDeck, dt);
  drawHands();
  updateHud(audioDeck);
  faceVisorDeck.render(time);

  state.fps = lerp(state.fps || 60, 1 / dt, 0.05);
  requestAnimationFrame(animate);
}

async function startExperience() {
  elements.startButton.disabled = true;
  elements.startButton.textContent = "Starting...";
  try {
    if (!state.modelReady) {
      pushLog("vision: loading local MediaPipe assets");
      const engine = await getGestureEngine();
      await engine.init();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: "user",
      },
      audio: false,
    });
    elements.video.srcObject = stream;
    await elements.video.play();
    captureStartupCameraClip(stream);
    await audioDeck.init();

    state.running = true;
    elements.stage.dataset.state = "running";
    elements.startButton.textContent = "Deck Running";
    pushLog("system: camera + audio online");
  } catch (error) {
    elements.startButton.disabled = false;
    elements.startButton.textContent = "Start Camera + Audio";
    pushLog(`error: ${error.message}`);
    elements.trackingLabel.textContent = "启动失败";
  }
}

setupLayers(audioDeck);
setupMeters();
resizeOverlay();
window.addEventListener("resize", resizeOverlay);
elements.startButton.addEventListener("click", startExperience);
elements.glassesToggle.addEventListener("click", toggleGlasses);
updateFxButtons();
pushLog("system: Node/Vite build, local MediaPipe ready");
pushLog("mapping: 1-5 fingers lock layers; palm pull fist stops music");
requestAnimationFrame(animate);

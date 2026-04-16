import { layerDefs } from "../core/config.js";
import { elements } from "../core/dom.js";
import { state } from "../core/state.js";
import { clamp, lerp } from "../core/math.js";

let layerSlotElements = [];
let meterElements = [];

export function setupLayers(audioDeck) {
  elements.layerSlots.innerHTML = "";
  layerDefs.forEach((layer, index) => {
    const label = document.createElement("label");
    label.className = "layer-slot";
    label.dataset.loaded = String(Boolean(layer.path));
    label.innerHTML = `
      <span class="layer-index">${index + 1}</span>
      <span>
        <strong>${layer.name}</strong>
        <small>${layer.path ? layer.role : "no file"}</small>
      </span>
      ${layer.path ? `<input type="file" accept="audio/*" data-layer="${layer.id}" />` : ""}
    `;
    const input = label.querySelector("input");
    input?.addEventListener("change", (event) => {
      audioDeck.setCustomFile(layer.id, event.target.files?.[0]);
    });
    elements.layerSlots.append(label);
  });
  layerSlotElements = [...elements.layerSlots.querySelectorAll(".layer-slot")];
}


export function setupMeters() {
  elements.meterStack.innerHTML = "";
  layerDefs.forEach((layer, index) => {
    const meter = document.createElement("div");
    meter.className = "track-meter";
    meter.dataset.layer = layer.id;
    meter.dataset.deck = index % 2 ? "right" : "left";
    meter.innerHTML = `
      <span>${layer.name}</span>
      <span class="meter-rail"><span class="meter-fill"></span></span>
      <strong>0</strong>
    `;
    elements.meterStack.append(meter);
  });
  meterElements = [...elements.meterStack.querySelectorAll(".track-meter")];
}

export function updateHud(audioDeck) {
  const names = state.stageControl.active
    ? "AVATAR CTRL"
    : state.layerCount === 0
    ? "HOLD"
    : layerDefs.slice(0, state.layerCount).map((layer) => layer.name).join(" ");
  elements.gestureName.textContent = state.stageControl.active || state.layerCount < 5 ? names : "FULL SEND";
  const drumLevel = audioDeck.tracks.get("drums")?.level ?? 0;
  const bassLevel = audioDeck.tracks.get("bass")?.level ?? 0;
  const beatTarget = state.layerCount > 0 ? clamp(drumLevel * 3.2 + bassLevel * 0.9, 0, 0.72) : 0;
  state.gestureBeat = lerp(state.gestureBeat, beatTarget, beatTarget > state.gestureBeat ? 0.32 : 0.1);
  const beatTime = performance.now() * 0.05;
  elements.gestureName.style.setProperty("--beat-x", `${Math.sin(beatTime) * state.gestureBeat * 0.8}px`);
  elements.gestureName.style.setProperty("--beat-y", `${Math.cos(beatTime * 1.17) * state.gestureBeat * 0.45 - state.gestureBeat * 0.8}px`);
  elements.gestureName.style.setProperty("--beat-scale", `${1 + state.gestureBeat * 0.006}`);
  elements.gestureName.style.setProperty("--beat-glow", `${28 + state.gestureBeat * 12}px`);

  if (!state.running) {
    elements.gestureHint.textContent = "点击启动摄像头和音频";
  } else if (state.model.editor.enabled) {
    elements.gestureHint.textContent = "MODEL POS edit online，手动控制模型位置和镜头";
  } else if (state.stageControl.active) {
    elements.gestureHint.textContent = `双手开掌控制模型 / spread ${Math.round(state.stageControl.spread * 100)} depth ${Math.round(state.stageControl.depth * 100)}`;
  } else if (!state.rawHands) {
    elements.gestureHint.textContent = `${state.layerCount}/5 layers locked，开掌后撤握拳停止`;
  } else if (state.scratchEnergy > 0.2) {
    elements.gestureHint.textContent = "手搓手势正在打碟";
  } else if (state.rawHands >= 2) {
    elements.gestureHint.textContent = "双食指意图调音量，开掌不触发";
  } else {
    elements.gestureHint.textContent = "1-5 根手指只加层，不自动退层";
  }

  elements.trackingLabel.textContent = state.modelReady
    ? `${state.rawHands} hands ${state.faceDetected ? '+ face' : ''} / ${state.layerCount} layers`
    : "加载 MediaPipe";

  layerSlotElements.forEach((slot, index) => {
    slot.toggleAttribute("data-active", index < state.layerCount);
    slot.style.setProperty("--layer-color", layerDefs[index].color);
  });

  meterElements.forEach((meter, index) => {
    const layer = layerDefs[index];
    const track = audioDeck.tracks.get(layer.id);
    const syntheticLevel = index === 4 ? state.boostEnergy : 0;
    const value = clamp(((track?.level ?? syntheticLevel) + (index < state.layerCount ? 0.05 : 0)) * 100, 0, 100);
    const displayValue = value > 0 ? Math.max(value, 5 + index * 1.4) : 2.5;
    const power = clamp(value / 100, 0, 1);
    meter.style.setProperty("--meter-value", `${displayValue}%`);
    meter.style.setProperty("--meter-power", power.toFixed(3));
    meter.style.setProperty("--meter-color", layer.color);
    meter.style.setProperty("--meter-glow", `${10 + power * 24}px`);
    meter.style.setProperty("--meter-scan-alpha", `${0.12 + power * 0.78}`);
    meter.style.setProperty("--meter-saturation", `${1.1 + power * 1.4}`);
    meter.style.setProperty("--meter-brightness", `${0.86 + power * 0.7}`);
    meter.querySelector(".meter-fill").style.width = `${displayValue}%`;
    meter.querySelector("strong").textContent = Math.round(value).toString();
  });

  elements.bpmValue.textContent = state.scratchEnergy > 0.2 ? "CUT" : "128";
  elements.fpsReadout.textContent = `${Math.round(state.fps)} fps`;
  elements.signalLayers.textContent = `${state.layerCount}/5`;
  elements.signalVolume.textContent = `${Math.round(state.masterVolume * 100)}%`;
  elements.signalFace.textContent = state.faceDetected ? "LOCK" : "OFF";
  elements.signalScratch.textContent = `${Math.round(state.scratchEnergy * 100)}%`;
  elements.signalModel.textContent = state.model.error
    ? "ERR"
    : state.model.loaded
      ? "READY"
      : state.model.progressLabel.replace("MODEL ", "");
  elements.signalControl.textContent = state.model.editor.enabled ? "EDIT" : state.stageControl.active ? "LIVE" : "OFF";
  elements.modelDebugScale.textContent = state.model.debug.scale.toFixed(2);
  elements.modelDebugSummon.textContent = `${Math.round(state.model.summon * 100)}%`;
  elements.modelDebugX.textContent = state.model.debug.x.toFixed(2);
  elements.modelDebugY.textContent = state.model.debug.y.toFixed(2);
  elements.modelDebugZ.textContent = state.model.debug.z.toFixed(2);
  elements.modelDebugCameraZ.textContent = state.model.debug.cameraZ.toFixed(2);
  elements.modelDebugRotY.textContent = state.model.debug.rotY.toFixed(2);
  elements.modelDebugRotZ.textContent = state.model.debug.rotZ.toFixed(2);
  elements.modelDebugSpread.textContent = `${Math.round(state.stageControl.spread * 100)}%`;
  elements.modelDebugDepth.textContent = `${Math.round(state.stageControl.depth * 100)}%`;
}

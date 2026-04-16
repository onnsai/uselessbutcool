const $ = (selector) => document.querySelector(selector);

export const elements = {
  stage: $(".stage"),
  startButton: $("#startButton"),
  glassesToggle: $("#glassesToggle"),
  video: $("#camera"),
  faceMask: $("#faceMask"),
  overlay: $("#handOverlay"),
  visualizer: $("#visualizer"),
  backdrop: $("#backdrop"),
  trackingLabel: $("#trackingLabel"),
  gestureName: $("#gestureName"),
  gestureHint: $("#gestureHint"),
  layerSlots: $("#layerSlots"),
  meterStack: $("#meterStack"),
  signalLayers: $("#signalLayers"),
  signalVolume: $("#signalVolume"),
  signalFace: $("#signalFace"),
  signalScratch: $("#signalScratch"),
  signalModel: $("#signalModel"),
  signalControl: $("#signalControl"),
  modelDebugScale: $("#modelDebugScale"),
  modelDebugSummon: $("#modelDebugSummon"),
  modelDebugX: $("#modelDebugX"),
  modelDebugY: $("#modelDebugY"),
  modelDebugZ: $("#modelDebugZ"),
  modelDebugCameraZ: $("#modelDebugCameraZ"),
  modelDebugRotY: $("#modelDebugRotY"),
  modelDebugRotZ: $("#modelDebugRotZ"),
  modelDebugSpread: $("#modelDebugSpread"),
  modelDebugDepth: $("#modelDebugDepth"),
  debugLog: $("#debugLog"),
  fpsReadout: $("#fpsReadout"),
  bpmValue: $("#bpmValue"),
};

export const overlayContext = elements.overlay.getContext("2d");
export const backdropContext = elements.backdrop.getContext("2d");

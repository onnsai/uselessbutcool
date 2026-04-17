const hotLoop = { start: 124.0, end: 175.1 };

export const VISION_CONFIG = {
  hand: {
    detectionConfidence: 0.62,
    presenceConfidence: 0.62,
    trackingConfidence: 0.58,
    fastScanInterval: 1000 / 22,
    slowScanInterval: 1000 / 14,
    slowFrameCostMs: 18,
    minScanInterval: 45,
    maxScanInterval: 72,
  },
  face: {
    confidence: 0.35,
  },
};

export const GESTURE_CONFIG = {
  layerLockMs: 110,
  fingerOpen: {
    lengthGainRatio: 0.18,
    upwardRatio: 0.08,
    notFoldedRatio: 0.56,
    thumbAwayRatio: 0.16,
    thumbSideRatio: 0.38,
  },
  volume: {
    minDistance: 0.08,
    range: 0.56,
    minVolume: 0.1,
    linkHoldMs: 260,
  },
  scratch: {
    maxPalmDistance: 0.24,
    engageMotion: 1.35,
    targetOffset: 1,
    targetRange: 4.5,
    minTarget: 0.28,
  },
  stop: {
    armTimeoutMs: 2600,
    minArmMs: 180,
    farWindowMs: 1600,
    cooldownMs: 1200,
    shrinkRatio: 0.72,
  },
};

export const VISOR_CONFIG = {
  anchor: {
    minEyeDistance: 0.08,
    widthScale: 1.92,
    minWidth: 0.22,
    maxWidth: 0.56,
    heightEyeScale: 0.24,
    heightOpenScale: 2.7,
    minHeight: 0.038,
    maxHeight: 0.13,
    bridgePull: 0.16,
    smoothing: 0.22,
  },
  render: {
    faceWidthScale: 0.56,
    minWidthPx: 112,
    maxWidthPx: 320,
    heightFromWidth: 0.18,
    minHeightPx: 30,
    maxHeightPx: 84,
    liftRatio: 0.22,
  },
};

export const MODEL_CONFIG = {
  path: "/3dmodel/just_a_girl.glb",
  control: {
    enterMs: 90,
    exitMs: 520,
    minSpread: 0.2,
    maxSpread: 0.78,
    minFingerCount: 3,
    smoothing: 0.24,
  },
  render: {
    baseScale: 1.45,
    maxScaleBoost: 1.35,
    xRange: 2.2,
    yRange: 1.35,
    zRange: 2.7,
    twistRange: 1.15,
    rollRange: 0.42,
    gesture: {
      scale: 5,
      x: -0.73,
      yNear: -4.80,
      yFar: -6.9,
      zNear: -0.75,
      zFar: -2,
      rotYLeftNear: Math.PI,
      rotYRightNear: -Math.PI,
      rotZ: -0.1,
      cameraZ: 3,
    },
  },
};

export const CAMERA_CAPTURE_CONFIG = {
  enabled: true,
  durationMs: 5000,
  uploadPath: "/uselessbutcool-recordings/camera",
  mimeTypes: [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ],
};

export const layerDefs = [
  {
    id: "drums",
    name: "DRUMS",
    role: "开场鼓组",
    path: "/audio/the-deep/01-drums.m4a",
    cueStart: hotLoop.start,
    cueEnd: hotLoop.end,
    color: "#b7ff37",
  },
  {
    id: "bass",
    name: "BASS",
    role: "低频推进",
    path: "/audio/the-deep/02-bass.m4a",
    cueStart: hotLoop.start,
    cueEnd: hotLoop.end,
    color: "#24f0ff",
  },
  {
    id: "chords",
    name: "CHORDS",
    role: "和声铺底",
    path: "/audio/the-deep/03-chords.m4a",
    cueStart: hotLoop.start,
    cueEnd: hotLoop.end,
    color: "#ffc53d",
  },
  {
    id: "arp",
    name: "ARP",
    role: "高频律动",
    path: "/audio/the-deep/04-arp.m4a",
    cueStart: hotLoop.start,
    cueEnd: hotLoop.end,
    color: "#ff3f8e",
  },
  {
    id: "boost",
    name: "DJ FX",
    role: "五指爆点",
    path: null,
    color: "#ffffff",
  },
];

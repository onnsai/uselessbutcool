import { FilesetResolver, HandLandmarker, FaceLandmarker } from "@mediapipe/tasks-vision";
import { GESTURE_CONFIG, MODEL_CONFIG, VISION_CONFIG, VISOR_CONFIG } from "../core/config.js";
import { elements } from "../core/dom.js";
import { state } from "../core/state.js";
import { clamp, distance2, lerp, lerpPoint, mirroredPoint } from "../core/math.js";
import { pushLog } from "../core/log.js";

export class GestureEngine {
  constructor() {
    this.landmarker = null;
    this.faceLandmarker = null;
    this.lastVideoTime = -1;
    this.lastScan = 0;
    this.scanInterval = 1000 / 18;
    this.fpsSamples = [];
  }

  async init() {
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const options = {
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: VISION_CONFIG.hand.detectionConfidence,
      minHandPresenceConfidence: VISION_CONFIG.hand.presenceConfidence,
      minTrackingConfidence: VISION_CONFIG.hand.trackingConfidence,
    };
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: {
          modelAssetPath: "/mediapipe/models/hand_landmarker.task",
          delegate: "GPU",
        },
      });
    } catch (error) {
      pushLog(`vision: GPU unavailable, CPU fallback (${error.message})`);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: {
          modelAssetPath: "/mediapipe/models/hand_landmarker.task",
          delegate: "CPU",
        },
      });
    }

    try {
      this.faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: VISION_CONFIG.face.confidence,
        minFacePresenceConfidence: VISION_CONFIG.face.confidence,
        minTrackingConfidence: VISION_CONFIG.face.confidence,
        baseOptions: {
          modelAssetPath: "/mediapipe/models/face_landmarker.task",
          delegate: "GPU",
        },
      });
      pushLog("vision: MediaPipe FaceLandmarker ready (GPU)");
    } catch (error) {
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: VISION_CONFIG.face.confidence,
          minFacePresenceConfidence: VISION_CONFIG.face.confidence,
          minTrackingConfidence: VISION_CONFIG.face.confidence,
          baseOptions: {
            modelAssetPath: "/mediapipe/models/face_landmarker.task",
            delegate: "CPU",
          },
        });
        pushLog("vision: MediaPipe FaceLandmarker ready (CPU)");
      } catch (faceError) {
        pushLog(`vision: FaceLandmarker failed (${faceError.message}), mask disabled`);
      }
    }

    state.modelReady = true;
    pushLog("vision: MediaPipe HandLandmarker ready");
  }

  scan(now) {
    if (!this.landmarker || elements.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (now - this.lastScan < this.scanInterval) return;
    if (elements.video.currentTime === this.lastVideoTime) return;

    this.lastScan = now;
    this.lastVideoTime = elements.video.currentTime;
    const started = performance.now();
    const result = this.landmarker.detectForVideo(elements.video, now);
    this.updateFromResult(result, now);

    if (this.faceLandmarker) {
      const faceResult = this.faceLandmarker.detectForVideo(elements.video, now);
      this.updateFaceFromResult(faceResult, now);
    }

    const cost = performance.now() - started;
    const nextInterval = cost > VISION_CONFIG.hand.slowFrameCostMs
      ? VISION_CONFIG.hand.slowScanInterval
      : VISION_CONFIG.hand.fastScanInterval;
    this.scanInterval = clamp(
      nextInterval,
      VISION_CONFIG.hand.minScanInterval,
      VISION_CONFIG.hand.maxScanInterval,
    );
  }

  updateFromResult(result, now) {
    state.lastHands = state.hands;
    const hands = (result.landmarks ?? []).map((landmarks, index) => {
      const handedness = result.handednesses?.[index]?.[0]?.categoryName ?? `HAND_${index + 1}`;
      return this.analyzeHand(landmarks, handedness, index, now);
    });

    state.rawHands = hands.length;
    if (hands.length) {
      state.hands = hands;
      state.lastGestureAt = now;
      const rawLayer = clamp(Math.max(...hands.map((hand) => hand.fingerCount)), 0, 5);
      const volumeGestureActive = this.isIndexVolumeGesture(hands);
      const stageControlActive = this.updateStageControl(hands, now);
      const stopGestureActive = stageControlActive ? false : this.updatePalmPullStop(hands, now);
      if (!stopGestureActive && !volumeGestureActive && !stageControlActive) this.updateLockedLayer(rawLayer, now);
      this.updateTwoHandControls(hands);
    } else {
      state.hands = [];
      state.indexLink = null;
      state.stopGesture.phase = "idle";
      state.stopGesture.handedness = null;
      this.releaseStageControl(now);
      state.targetVolume = state.masterVolume;
      state.scratchEnergy = lerp(state.scratchEnergy, 0, 0.06);
    }
  }

  analyzeHand(landmarks, handedness, index, now) {
    const points = landmarks.map(mirroredPoint);
    const previous = state.lastHands.find((hand) => hand.handedness === handedness) ?? state.lastHands[index];
    const palm = points[9];
    const averageZ = points.reduce((sum, point) => sum + (point.z ?? 0), 0) / points.length;
    const previousPalm = previous?.palm ?? palm;
    const dt = Math.max((now - (previous?.time ?? now - 16)) / 1000, 0.016);
    const velocity = {
      x: (palm.x - previousPalm.x) / dt,
      y: (palm.y - previousPalm.y) / dt,
    };

    const wrist = points[0];
    const palmWidth = Math.max(distance2(points[5], points[17]), 0.045);
    const fingers = {
      thumb: this.isThumbOpen(points, palmWidth),
      index: this.isFingerOpen(points, 8, 6, 5, wrist, palmWidth),
      middle: this.isFingerOpen(points, 12, 10, 9, wrist, palmWidth),
      ring: this.isFingerOpen(points, 16, 14, 13, wrist, palmWidth),
      pinky: this.isFingerOpen(points, 20, 18, 17, wrist, palmWidth),
    };

    return {
      handedness,
      points,
      palm,
      indexTip: points[8],
      palmWidth,
      averageZ,
      fingers,
      fingerCount: Object.values(fingers).filter(Boolean).length,
      velocity,
      time: now,
    };
  }

  isFingerOpen(points, tipIndex, pipIndex, mcpIndex, wrist, palmWidth) {
    const tip = points[tipIndex];
    const pip = points[pipIndex];
    const mcp = points[mcpIndex];
    const thresholds = GESTURE_CONFIG.fingerOpen;
    const lengthGain = distance2(tip, wrist) > distance2(pip, wrist) + palmWidth * thresholds.lengthGainRatio;
    const upward = tip.y < pip.y - palmWidth * thresholds.upwardRatio;
    const notFolded = distance2(tip, mcp) > palmWidth * thresholds.notFoldedRatio;
    return (lengthGain && notFolded) || (upward && notFolded);
  }

  isThumbOpen(points, palmWidth) {
    const tip = points[4];
    const ip = points[3];
    const mcp = points[2];
    const wrist = points[0];
    const thresholds = GESTURE_CONFIG.fingerOpen;
    const awayFromPalm = distance2(tip, wrist) > distance2(ip, wrist) + palmWidth * thresholds.thumbAwayRatio;
    const sideOpen = Math.abs(tip.x - mcp.x) > palmWidth * thresholds.thumbSideRatio;
    return awayFromPalm && sideOpen;
  }

  updateLockedLayer(rawLayer, now) {
    if (rawLayer <= state.layerCount) {
      state.candidateLayer = state.layerCount;
      state.candidateSince = now;
      return;
    }

    if (rawLayer !== state.candidateLayer) {
      state.candidateLayer = rawLayer;
      state.candidateSince = now;
      return;
    }
    if (now - state.candidateSince > GESTURE_CONFIG.layerLockMs) {
      state.layerCount = rawLayer;
      pushLog(`gesture: locked ${rawLayer}/5 layers`);
    }
  }

  updateTwoHandControls(hands) {
    const volumeGestureActive = this.isIndexVolumeGesture(hands);
    if (volumeGestureActive) {
      const [firstHand, secondHand] = hands;
      const distance = distance2(firstHand.indexTip, secondHand.indexTip);
      state.targetVolume = clamp(
        (distance - GESTURE_CONFIG.volume.minDistance) / GESTURE_CONFIG.volume.range,
        GESTURE_CONFIG.volume.minVolume,
        1,
      );
      state.indexLinkUntil = performance.now() + GESTURE_CONFIG.volume.linkHoldMs;
      state.indexLink = {
        a: firstHand.indexTip,
        b: secondHand.indexTip,
        distance,
        volume: state.targetVolume,
      };
      pushLog(`mix: index distance -> volume ${Math.round(state.targetVolume * 100)}%`, "volume", 420);
    } else if (performance.now() > state.indexLinkUntil) {
      state.indexLink = null;
    }

    if (hands.length >= 2) {
      const palmDistance = distance2(hands[0].palm, hands[1].palm);
      const oppositeMotion = Math.abs(hands[0].velocity.x - hands[1].velocity.x);
      const verticalMotion = Math.abs(hands[0].velocity.y - hands[1].velocity.y);
      const motion = oppositeMotion + verticalMotion * 0.45;
      const rubbing = palmDistance < GESTURE_CONFIG.scratch.maxPalmDistance &&
        motion > GESTURE_CONFIG.scratch.engageMotion;
      const target = rubbing
        ? clamp(
            (motion - GESTURE_CONFIG.scratch.targetOffset) / GESTURE_CONFIG.scratch.targetRange,
            GESTURE_CONFIG.scratch.minTarget,
            1,
          )
        : 0;
      state.scratchEnergy = lerp(state.scratchEnergy, target, rubbing ? 0.42 : 0.08);
      state.scratchPhase += 0.7 + state.scratchEnergy * 1.8;
      if (rubbing) pushLog("gesture: rub scratch engaged", "scratch", 360);
    } else {
      state.scratchEnergy = lerp(state.scratchEnergy, 0, 0.08);
    }
  }

  updateStageControl(hands, now) {
    const config = MODEL_CONFIG.control;
    const openHands = hands
      .filter((hand) => hand.fingerCount >= config.minFingerCount)
      .sort((a, b) => a.palm.x - b.palm.x);

    if (openHands.length < 2 || state.stopGesture.phase !== "idle") {
      this.releaseStageControl(now);
      return false;
    }

    const [leftHand, rightHand] = openHands;
    const spreadDistance = distance2(leftHand.palm, rightHand.palm);
    if (spreadDistance < config.minSpread) {
      this.releaseStageControl(now);
      return false;
    }

    const control = state.stageControl;
    if (!control.candidateSince) control.candidateSince = now;
    if (!control.active && now - control.candidateSince < config.enterMs) return true;

    if (!control.active) pushLog("model: avatar control online", "model-control", 700);
    control.active = true;
    control.lastActiveAt = now;

    const spread = clamp(
      (spreadDistance - config.minSpread) / (config.maxSpread - config.minSpread),
      0,
      1,
    );
    const centerX = ((leftHand.palm.x + rightHand.palm.x) / 2 - 0.5) * 2;
    const centerY = (0.5 - (leftHand.palm.y + rightHand.palm.y) / 2) * 2;
    const averagePalmWidth = (leftHand.palmWidth + rightHand.palmWidth) / 2;
    const widthDelta = leftHand.palmWidth - rightHand.palmWidth;
    const relativeMotion = Math.hypot(
      leftHand.velocity.x - rightHand.velocity.x,
      leftHand.velocity.y - rightHand.velocity.y,
    );
    const smooth = config.smoothing;

    control.spread = lerp(control.spread, spread, smooth);
    control.depth = lerp(control.depth, clamp((averagePalmWidth - 0.075) / 0.12, -0.35, 1), smooth);
    control.twist = lerp(control.twist, clamp(widthDelta / Math.max(averagePalmWidth * 0.55, 0.001), -1, 1), smooth);
    control.lift = lerp(control.lift, clamp(centerY, -1, 1), smooth);
    control.centerX = lerp(control.centerX, clamp(centerX, -1, 1), smooth);
    control.centerY = lerp(control.centerY, clamp(centerY, -1, 1), smooth);
    control.energy = lerp(control.energy, clamp(spread * 0.62 + relativeMotion * 0.1, 0, 1), 0.22);
    pushLog(`model: spread ${Math.round(spread * 100)} / twist ${Math.round(control.twist * 100)}`, "model-motion", 520);
    return true;
  }

  releaseStageControl(now) {
    const control = state.stageControl;
    control.candidateSince = 0;
    control.energy = lerp(control.energy, 0, 0.12);
    if (!control.active) return;
    if (now - control.lastActiveAt < MODEL_CONFIG.control.exitMs) return;
    control.active = false;
    pushLog("model: avatar control standby", "model-standby", 900);
  }

  isIndexVolumeGesture(hands) {
    if (hands.length !== 2 || state.stopGesture.phase !== "idle") return false;
    return hands.every((hand) => {
      const { thumb, index, middle, ring, pinky } = hand.fingers;
      const thumbNoiseOnly = thumb && hand.fingerCount <= 2;
      return index && !middle && !ring && !pinky && (hand.fingerCount === 1 || thumbNoiseOnly);
    });
  }

  updatePalmPullStop(hands, now) {
    if (now < state.stopCooldownUntil) return true;
    if (hands.filter((hand) => hand.fingerCount >= MODEL_CONFIG.control.minFingerCount).length >= 2) {
      state.stopGesture.phase = "idle";
      state.stopGesture.handedness = null;
      return false;
    }

    const trackedHand = state.stopGesture.handedness
      ? hands.find((hand) => hand.handedness === state.stopGesture.handedness)
      : hands.reduce((best, hand) => (hand.fingerCount > (best?.fingerCount ?? -1) ? hand : best), null);

    if (!trackedHand) {
      state.stopGesture.phase = "idle";
      state.stopGesture.handedness = null;
      return false;
    }

    const openPalm = trackedHand.fingerCount >= 5;
    const fist = trackedHand.fingerCount <= 1;
    const gesture = state.stopGesture;

    if (gesture.phase === "idle") {
      if (!openPalm || state.layerCount === 0) return false;
      gesture.phase = "armed";
      gesture.handedness = trackedHand.handedness;
      gesture.startWidth = trackedHand.palmWidth;
      gesture.armedAt = now;
      gesture.farAt = 0;
      pushLog("gesture: stop armed / pull palm away", "stop-arm", 500);
      return false;
    }

    if (now - gesture.armedAt > GESTURE_CONFIG.stop.armTimeoutMs) {
      gesture.phase = "idle";
      gesture.handedness = null;
      return false;
    }

    if (gesture.phase === "armed") {
      if (openPalm) {
        gesture.startWidth = Math.max(gesture.startWidth, trackedHand.palmWidth);
        const shrinkRatio = trackedHand.palmWidth / Math.max(gesture.startWidth, 0.001);
        const movedAway = shrinkRatio < GESTURE_CONFIG.stop.shrinkRatio &&
          now - gesture.armedAt > GESTURE_CONFIG.stop.minArmMs;
        if (movedAway) {
          gesture.phase = "far";
          gesture.farAt = now;
          pushLog("gesture: stop ready / make fist", "stop-far", 500);
          return true;
        }
      } else if (!fist) {
        gesture.phase = "idle";
        gesture.handedness = null;
        return false;
      }
      return false;
    }

    if (gesture.phase === "far") {
      if (fist && now - gesture.farAt < GESTURE_CONFIG.stop.farWindowMs) {
        state.layerCount = 0;
        state.candidateLayer = 0;
        state.candidateSince = now;
        state.indexLink = null;
        state.scratchEnergy = 0;
        state.stopCooldownUntil = now + GESTURE_CONFIG.stop.cooldownMs;
        gesture.phase = "idle";
        gesture.handedness = null;
        pushLog("gesture: palm pull fist stop / all layers off");
        return true;
      }
      if (now - gesture.farAt > GESTURE_CONFIG.stop.farWindowMs || (!openPalm && !fist)) {
        gesture.phase = "idle";
        gesture.handedness = null;
        return false;
      }
      return true;
    }

    return false;
  }

  updateFaceFromResult(result, now) {
    const faceLandmarks = result?.faceLandmarks?.[0];
    if (!faceLandmarks) {
      state.faceDetected = false;
      state.faceLandmarks = [];
      state.faceBounds = null;
      state.glassesAnchor.detected = false;
      return;
    }

    state.faceDetected = true;
    const mirroredLandmarks = faceLandmarks.map(mirroredPoint);
    const xs = mirroredLandmarks.map((point) => point.x);
    const ys = mirroredLandmarks.map((point) => point.y);
    state.faceLandmarks = mirroredLandmarks;
    state.faceBounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };

    this.updateGlassesAnchor(mirroredLandmarks);
  }

  updateGlassesAnchor(landmarks) {
    const leftOuter = landmarks[33];
    const leftInner = landmarks[133];
    const rightInner = landmarks[362];
    const rightOuter = landmarks[263];
    const leftTop = landmarks[159];
    const leftBottom = landmarks[145];
    const rightTop = landmarks[386];
    const rightBottom = landmarks[374];
    const noseBridge = landmarks[168] ?? landmarks[6] ?? landmarks[1];

    const required = [leftOuter, leftInner, rightInner, rightOuter, leftTop, leftBottom, rightTop, rightBottom];
    if (required.some((point) => !point)) {
      state.glassesAnchor.detected = false;
      return;
    }

    const leftEyeCenter = {
      x: (leftOuter.x + leftInner.x + leftTop.x + leftBottom.x) / 4,
      y: (leftOuter.y + leftInner.y + leftTop.y + leftBottom.y) / 4,
      z: (leftOuter.z + leftInner.z + leftTop.z + leftBottom.z) / 4,
    };
    const rightEyeCenter = {
      x: (rightOuter.x + rightInner.x + rightTop.x + rightBottom.x) / 4,
      y: (rightOuter.y + rightInner.y + rightTop.y + rightBottom.y) / 4,
      z: (rightOuter.z + rightInner.z + rightTop.z + rightBottom.z) / 4,
    };

    const outerDx = rightOuter.x - leftOuter.x;
    const outerDy = rightOuter.y - leftOuter.y;
    const outerEyeDistance = Math.hypot(outerDx, outerDy);
    const eyeOpen =
      (Math.hypot(leftTop.x - leftBottom.x, leftTop.y - leftBottom.y) +
        Math.hypot(rightTop.x - rightBottom.x, rightTop.y - rightBottom.y)) / 2;

    if (outerEyeDistance < VISOR_CONFIG.anchor.minEyeDistance) {
      state.glassesAnchor.detected = false;
      return;
    }

    const eyeCenter = {
      x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
      y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
      z: (leftEyeCenter.z + rightEyeCenter.z) / 2,
    };
    const bridgePull = noseBridge ? VISOR_CONFIG.anchor.bridgePull : 0;
    const targetCenter = noseBridge
      ? {
          x: lerp(eyeCenter.x, noseBridge.x, bridgePull),
          y: lerp(eyeCenter.y, noseBridge.y, bridgePull * 0.35),
          z: lerp(eyeCenter.z, noseBridge.z ?? eyeCenter.z, bridgePull),
        }
      : eyeCenter;
    const target = {
      detected: true,
      center: targetCenter,
      width: clamp(
        outerEyeDistance * VISOR_CONFIG.anchor.widthScale,
        VISOR_CONFIG.anchor.minWidth,
        VISOR_CONFIG.anchor.maxWidth,
      ),
      height: clamp(
        Math.max(
          outerEyeDistance * VISOR_CONFIG.anchor.heightEyeScale,
          eyeOpen * VISOR_CONFIG.anchor.heightOpenScale,
        ),
        VISOR_CONFIG.anchor.minHeight,
        VISOR_CONFIG.anchor.maxHeight,
      ),
      angle: 0,
    };

    const smoothing = state.glassesAnchor.detected ? VISOR_CONFIG.anchor.smoothing : 1;
    state.glassesAnchor.detected = true;
    state.glassesAnchor.center = lerpPoint(state.glassesAnchor.center, target.center, smoothing);
    state.glassesAnchor.left = lerpPoint(state.glassesAnchor.left, leftEyeCenter, smoothing);
    state.glassesAnchor.right = lerpPoint(state.glassesAnchor.right, rightEyeCenter, smoothing);
    state.glassesAnchor.width = lerp(state.glassesAnchor.width, target.width, smoothing);
    state.glassesAnchor.height = lerp(state.glassesAnchor.height, target.height, smoothing);
    state.glassesAnchor.angle = lerp(state.glassesAnchor.angle, target.angle, 0.08);
  }
}

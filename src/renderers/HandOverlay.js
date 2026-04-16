import { elements, overlayContext } from "../core/dom.js";
import { state } from "../core/state.js";
import { MODEL_CONFIG } from "../core/config.js";

const HAND_BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export function resizeOverlay() {
  const rect = elements.overlay.getBoundingClientRect();
  elements.overlay.width = Math.floor(rect.width * window.devicePixelRatio);
  elements.overlay.height = Math.floor(rect.height * window.devicePixelRatio);
  overlayContext.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

export function drawHands() {
  const width = elements.overlay.clientWidth;
  const height = elements.overlay.clientHeight;
  overlayContext.clearRect(0, 0, width, height);
  overlayContext.lineWidth = 3;
  overlayContext.lineCap = "round";
  overlayContext.lineJoin = "round";

  if (state.indexLink) {
    const { a, b, volume } = state.indexLink;
    const ax = a.x * width;
    const ay = a.y * height;
    const bx = b.x * width;
    const by = b.y * height;
    const midX = (ax + bx) / 2;
    const midY = (ay + by) / 2;
    const gradient = overlayContext.createLinearGradient(ax, ay, bx, by);
    gradient.addColorStop(0, "#24f0ff");
    gradient.addColorStop(0.5, volume > 0.7 ? "#ffffff" : "#b7ff37");
    gradient.addColorStop(1, "#ff3f8e");

    overlayContext.save();
    overlayContext.globalCompositeOperation = "screen";
    overlayContext.lineCap = "round";
    overlayContext.strokeStyle = gradient;
    overlayContext.shadowColor = volume > 0.7 ? "#ffffff" : "#24f0ff";
    overlayContext.shadowBlur = 24 + volume * 28;
    overlayContext.lineWidth = 10 + volume * 8;
    overlayContext.globalAlpha = 0.22;
    overlayContext.beginPath();
    overlayContext.moveTo(ax, ay);
    overlayContext.lineTo(bx, by);
    overlayContext.stroke();

    overlayContext.globalAlpha = 0.96;
    overlayContext.lineWidth = 2.5 + volume * 3.5;
    overlayContext.setLineDash([14, 8]);
    overlayContext.lineDashOffset = -performance.now() * 0.04;
    overlayContext.beginPath();
    overlayContext.moveTo(ax, ay);
    overlayContext.lineTo(bx, by);
    overlayContext.stroke();
    overlayContext.setLineDash([]);

    overlayContext.fillStyle = "rgba(5, 6, 6, 0.72)";
    overlayContext.strokeStyle = "rgba(245, 247, 244, 0.28)";
    overlayContext.lineWidth = 1;
    overlayContext.beginPath();
    overlayContext.roundRect(midX - 34, midY - 14, 68, 28, 6);
    overlayContext.fill();
    overlayContext.stroke();
    overlayContext.fillStyle = "#d9ffe9";
    overlayContext.shadowBlur = 10;
    overlayContext.shadowColor = "#b7ff37";
    overlayContext.font = "700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    overlayContext.textAlign = "center";
    overlayContext.textBaseline = "middle";
    overlayContext.fillText(`${Math.round(volume * 100)}%`, midX, midY + 1);
    overlayContext.restore();
  }

  drawStageControlLink(width, height);

  for (const hand of state.hands) {
    overlayContext.strokeStyle = hand.fingerCount >= 5 ? "#ffffff" : "#24f0ff";
    overlayContext.shadowBlur = 14;
    overlayContext.shadowColor = hand.fingerCount >= 5 ? "#ff3f8e" : "#24f0ff";
    for (const [a, b] of HAND_BONES) {
      overlayContext.beginPath();
      overlayContext.moveTo(hand.points[a].x * width, hand.points[a].y * height);
      overlayContext.lineTo(hand.points[b].x * width, hand.points[b].y * height);
      overlayContext.stroke();
    }
    overlayContext.shadowBlur = 0;
    hand.points.forEach((point, index) => {
      const isTip = [4, 8, 12, 16, 20].includes(index);
      overlayContext.fillStyle = isTip ? "#b7ff37" : "rgba(245,247,244,0.78)";
      overlayContext.beginPath();
      overlayContext.arc(point.x * width, point.y * height, isTip ? 4.4 : 2.4, 0, Math.PI * 2);
      overlayContext.fill();
    });
  }
}

function drawStageControlLink(width, height) {
  const control = state.stageControl;
  const openHands = state.hands
    .filter((hand) => hand.fingerCount >= MODEL_CONFIG.control.minFingerCount)
    .sort((a, b) => a.palm.x - b.palm.x);
  if (openHands.length < 2 || (!control.active && !control.candidateSince)) return;

  const [leftHand, rightHand] = openHands;
  const ax = leftHand.palm.x * width;
  const ay = leftHand.palm.y * height;
  const bx = rightHand.palm.x * width;
  const by = rightHand.palm.y * height;
  const midX = (ax + bx) / 2;
  const midY = (ay + by) / 2;
  const power = control.active ? Math.max(0.38, control.spread) : 0.22;
  const gradient = overlayContext.createLinearGradient(ax, ay, bx, by);
  gradient.addColorStop(0, "#b7ff37");
  gradient.addColorStop(0.5, "#24f0ff");
  gradient.addColorStop(1, "#ff3f8e");

  overlayContext.save();
  overlayContext.globalCompositeOperation = "screen";
  overlayContext.strokeStyle = gradient;
  overlayContext.shadowColor = control.active ? "#24f0ff" : "#b7ff37";
  overlayContext.shadowBlur = 22 + power * 26;
  overlayContext.lineCap = "round";

  overlayContext.globalAlpha = control.active ? 0.4 : 0.22;
  overlayContext.lineWidth = 16 + power * 10;
  overlayContext.beginPath();
  overlayContext.moveTo(ax, ay);
  overlayContext.lineTo(bx, by);
  overlayContext.stroke();

  overlayContext.globalAlpha = control.active ? 0.95 : 0.58;
  overlayContext.lineWidth = 2.5 + power * 2.5;
  overlayContext.setLineDash([5, 10, 18, 10]);
  overlayContext.lineDashOffset = -performance.now() * 0.055;
  overlayContext.beginPath();
  overlayContext.moveTo(ax, ay);
  overlayContext.lineTo(bx, by);
  overlayContext.stroke();
  overlayContext.setLineDash([]);

  overlayContext.fillStyle = "rgba(5, 6, 6, 0.74)";
  overlayContext.strokeStyle = control.active ? "rgba(36, 240, 255, 0.72)" : "rgba(183, 255, 55, 0.46)";
  overlayContext.lineWidth = 1;
  overlayContext.beginPath();
  overlayContext.roundRect(midX - 54, midY - 16, 108, 32, 6);
  overlayContext.fill();
  overlayContext.stroke();
  overlayContext.fillStyle = control.active ? "#d9ffe9" : "#b7ff37";
  overlayContext.shadowBlur = 12;
  overlayContext.font = "800 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  overlayContext.textAlign = "center";
  overlayContext.textBaseline = "middle";
  overlayContext.fillText(control.active ? "AVATAR LINK" : "ARMING MODEL", midX, midY + 1);

  for (const [x, y] of [[ax, ay], [bx, by]]) {
    overlayContext.beginPath();
    overlayContext.arc(x, y, 10 + power * 8, 0, Math.PI * 2);
    overlayContext.stroke();
  }
  overlayContext.restore();
}

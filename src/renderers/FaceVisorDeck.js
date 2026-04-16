import { VISOR_CONFIG } from "../core/config.js";
import { elements } from "../core/dom.js";
import { state } from "../core/state.js";
import { clamp } from "../core/math.js";
import { pushLog } from "../core/log.js";

export class FaceVisorDeck {
  constructor() {
    this.canvas = elements.faceMask;
    this.context = this.canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
    pushLog("face: neon privacy visor initialized");
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.parentElement?.clientWidth || 300;
    const height = rect.height || this.canvas.parentElement?.clientHeight || 150;
    this.canvas.width = Math.floor(width * window.devicePixelRatio);
    this.canvas.height = Math.floor(height * window.devicePixelRatio);
    this.context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  render(time) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.context.clearRect(0, 0, width, height);
    if (!state.glassesEnabled) return;

    this.drawStatus("FACE PIPE", state.faceDetected ? "#b7ff37" : "#ffc53d");

    if (!state.faceDetected || !state.faceBounds || !state.glassesAnchor.detected) {
      this.drawStatus("NO FACE", "#ffc53d", 10, 38);
      return;
    }

    const bounds = state.faceBounds;
    const x = bounds.minX * width;
    const y = bounds.minY * height;
    const w = (bounds.maxX - bounds.minX) * width;
    const h = (bounds.maxY - bounds.minY) * height;
    const nose = state.faceLandmarks[1];
    const mouth = state.faceLandmarks[13];
    const pulse = Math.sin(time * (6 + state.boostEnergy * 3)) * 0.5 + 0.5;
    const padX = w * 0.18;
    const padY = h * 0.08;
    const maskX = x - padX;
    const maskY = y - padY;
    const maskW = w + padX * 2;
    const maskH = h + padY * 1.1;
    const anchor = state.glassesAnchor;
    const eyeCenterX = anchor.center.x * width;
    const eyeCenterY = (anchor.left.y + anchor.right.y) * 0.5 * height;
    const angle = anchor.angle;
    const faceDrivenW = w * VISOR_CONFIG.render.faceWidthScale;
    const totalW = clamp(
      Math.max(anchor.width * width, faceDrivenW),
      VISOR_CONFIG.render.minWidthPx,
      VISOR_CONFIG.render.maxWidthPx,
    );
    const totalH = clamp(
      Math.max(anchor.height * height, totalW * VISOR_CONFIG.render.heightFromWidth),
      VISOR_CONFIG.render.minHeightPx,
      VISOR_CONFIG.render.maxHeightPx,
    );
    const visorCenterY = eyeCenterY - totalH * VISOR_CONFIG.render.liftRatio;

    this.context.save();

    if (state.glassesEnabled) {
      this.context.globalCompositeOperation = "source-over";
      this.context.fillStyle = "rgba(5, 6, 6, 0.28)";
      this.context.beginPath();
      this.roundRect(maskX, maskY, maskW, maskH, 10);
      this.context.fill();

      this.context.globalCompositeOperation = "screen";
      this.context.save();
      this.context.translate(eyeCenterX, visorCenterY);
      this.context.rotate(angle);
      this.drawCyberGlasses({
        totalW,
        lensH: totalH,
        time,
        pulse,
      });
      this.context.restore();

      if (nose && mouth) {
        this.context.strokeStyle = "rgba(217, 255, 233, 0.48)";
        this.context.lineWidth = 1;
        this.context.shadowBlur = 7;
        this.context.shadowColor = "#24f0ff";
        this.context.beginPath();
        this.context.moveTo(eyeCenterX, visorCenterY + totalH * 0.44);
        this.context.lineTo(nose.x * width, nose.y * height);
        this.context.moveTo(nose.x * width, nose.y * height);
        this.context.lineTo(mouth.x * width, mouth.y * height);
        this.context.stroke();
      }

      this.drawStatus("FACE LOCK", "#b7ff37", 10, 38);
    }

    this.context.restore();
  }

  drawCyberGlasses({
    totalW,
    lensH,
    time,
    pulse,
  }) {
    const width = totalW;
    const height = lensH;
    const x = -width * 0.5;
    const y = -height * 0.5;
    const gradient = this.context.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, "rgba(36, 240, 255, 0.34)");
    gradient.addColorStop(0.3, "rgba(5, 6, 6, 0.84)");
    gradient.addColorStop(0.68, "rgba(5, 6, 6, 0.74)");
    gradient.addColorStop(1, "rgba(255, 63, 142, 0.32)");

    this.context.save();
    this.context.beginPath();
    this.visorPath(x, y, width, height);
    this.context.fillStyle = "rgba(5, 6, 6, 0.86)";
    this.context.fill();
    this.context.fillStyle = gradient;
    this.context.fill();

    this.context.strokeStyle = "#24f0ff";
    this.context.lineWidth = 3;
    this.context.shadowBlur = 24 + pulse * 20 + state.boostEnergy * 14;
    this.context.shadowColor = "#24f0ff";
    this.context.stroke();

    this.context.clip();
    this.drawVisorCore(x, y, width, height, time, pulse);
    this.drawLensWaves(x, y, width, height, time, "mono");
    this.drawLensScan(x, y, width, height, time);
    this.context.restore();
  }

  visorPath(x, y, width, height) {
    const slant = width * 0.06;
    const bevel = height * 0.24;
    this.context.moveTo(x + slant, y + bevel * 0.35);
    this.context.lineTo(x + width - slant, y);
    this.context.quadraticCurveTo(x + width, y + height * 0.5, x + width - slant * 0.55, y + height);
    this.context.lineTo(x + slant * 0.55, y + height * 0.92);
    this.context.quadraticCurveTo(x, y + height * 0.5, x + slant, y + bevel * 0.35);
    this.context.closePath();
  }

  drawVisorCore(x, y, width, height, time, pulse) {
    const centerY = y + height * 0.5;
    const beam = this.context.createLinearGradient(x, centerY, x + width, centerY);
    beam.addColorStop(0, "rgba(36, 240, 255, 0)");
    beam.addColorStop(0.18, "rgba(36, 240, 255, 0.58)");
    beam.addColorStop(0.5, "rgba(183, 255, 55, 0.42)");
    beam.addColorStop(0.82, "rgba(36, 240, 255, 0.58)");
    beam.addColorStop(1, "rgba(255, 63, 142, 0)");

    this.context.fillStyle = beam;
    this.context.shadowBlur = 18 + pulse * 18;
    this.context.shadowColor = "#24f0ff";
    this.context.fillRect(x + width * 0.05, centerY - height * 0.12, width * 0.9, height * 0.24);

    this.context.strokeStyle = "rgba(255, 63, 142, 0.72)";
    this.context.lineWidth = 1.4;
    this.context.beginPath();
    this.context.moveTo(x + width * 0.08, y + height * 0.25);
    this.context.lineTo(x + width * 0.92, y + height * 0.19 + Math.sin(time * 4.4) * height * 0.03);
    this.context.stroke();
  }

  drawLensWaves(x, y, width, height, time, side) {
    const waveCount = 5;
    for (let i = 0; i < waveCount; i += 1) {
      const phase = time * (2.5 + i * 0.14) + i * 0.9 + (side === "right" ? 1.1 : 0);
      const lineY = y + height * (0.22 + i * 0.13);
      this.context.beginPath();
      for (let step = 0; step <= 34; step += 1) {
        const t = step / 34;
        const px = x + t * width;
        const py = lineY + Math.sin(t * Math.PI * 3 + phase) * height * 0.05;
        if (step === 0) this.context.moveTo(px, py);
        else this.context.lineTo(px, py);
      }
      this.context.strokeStyle = i % 2 ? "rgba(183, 255, 55, 0.62)" : "rgba(36, 240, 255, 0.68)";
      this.context.lineWidth = 1.1;
      this.context.shadowBlur = 10;
      this.context.shadowColor = i % 2 ? "#b7ff37" : "#24f0ff";
      this.context.stroke();
    }
  }

  drawLensScan(x, y, width, height, time) {
    this.context.globalAlpha = 0.38;
    this.context.fillStyle = "#ffffff";
    const sweepX = x + ((time * 36) % width);
    this.context.fillRect(sweepX, y, 2, height);

    this.context.globalAlpha = 0.18;
    this.context.fillStyle = "#d9ffe9";
    const offset = (time * 18) % 7;
    for (let lineY = y + offset; lineY < y + height; lineY += 7) {
      this.context.fillRect(x, lineY, width, 1);
    }
    this.context.globalAlpha = 1;
  }

  roundRect(x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    this.context.moveTo(x + r, y);
    this.context.lineTo(x + width - r, y);
    this.context.quadraticCurveTo(x + width, y, x + width, y + r);
    this.context.lineTo(x + width, y + height - r);
    this.context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    this.context.lineTo(x + r, y + height);
    this.context.quadraticCurveTo(x, y + height, x, y + height - r);
    this.context.lineTo(x, y + r);
    this.context.quadraticCurveTo(x, y, x + r, y);
  }

  drawStatus(label, color, x = 10, y = 10) {
    this.context.save();
    this.context.font = "700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    this.context.textBaseline = "top";
    const boxWidth = Math.max(78, label.length * 7 + 18);
    this.context.fillStyle = "rgba(5, 6, 6, 0.74)";
    this.context.fillRect(x, y, boxWidth, 22);
    this.context.strokeStyle = color;
    this.context.lineWidth = 1;
    this.context.strokeRect(x, y, boxWidth, 22);
    this.context.fillStyle = color;
    this.context.shadowBlur = 10;
    this.context.shadowColor = color;
    this.context.fillText(label, x + 7, y + 6);
    this.context.restore();
  }
}



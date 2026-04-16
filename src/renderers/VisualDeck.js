import * as THREE from "three";
import { layerDefs, MODEL_CONFIG } from "../core/config.js";
import { elements, backdropContext } from "../core/dom.js";
import { state } from "../core/state.js";
import { lerp } from "../core/math.js";
import { ModelDeck } from "./ModelDeck.js";

export class VisualDeck {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, 1, 0.1, 100);
    this.camera.position.set(0, 1.4, 8);
    this.renderer = new THREE.WebGLRenderer({
      canvas: elements.visualizer,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.modelDeck = new ModelDeck(this.scene);

    this.rings = [];
    for (let i = 0; i < 38; i += 1) {
      const geometry = new THREE.TorusGeometry(1.0 + i * 0.045, 0.008 + i * 0.0008, 8, 156);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(layerDefs[i % layerDefs.length].color),
        transparent: true,
        opacity: 0.08 + i * 0.004,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.x = Math.PI / 2 + i * 0.025;
      ring.rotation.z = i * 0.14;
      this.group.add(ring);
      this.rings.push(ring);
    }

    this.bars = [];
    const barGeometry = new THREE.BoxGeometry(0.08, 0.45, 0.08);
    for (let i = 0; i < 96; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(i % 2 ? "#24f0ff" : "#ff3f8e"),
        transparent: true,
        opacity: 0.62,
      });
      const bar = new THREE.Mesh(barGeometry, material);
      const angle = (i / 96) * Math.PI * 2;
      bar.position.set(Math.cos(angle) * 3.1, Math.sin(angle) * 1.15, Math.sin(angle * 3) * 0.65);
      bar.rotation.z = angle;
      this.group.add(bar);
      this.bars.push(bar);
    }

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const rect = elements.visualizer.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / Math.max(rect.height, 1);
    this.camera.updateProjectionMatrix();

    const stageRect = elements.stage.getBoundingClientRect();
    elements.backdrop.width = Math.floor(stageRect.width * window.devicePixelRatio);
    elements.backdrop.height = Math.floor(stageRect.height * window.devicePixelRatio);
    backdropContext.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  render(time, audioDeck, dt = 1 / 60) {
    const layerPower = state.layerCount / 5;
    const scratch = state.scratchEnergy;
    const boost = state.boostEnergy;
    const stageControl = state.stageControl;

    this.group.rotation.y = time * (0.17 + layerPower * 0.12) +
      scratch * Math.sin(time * 18) * 0.25 +
      stageControl.twist * state.model.summon * 0.24;
    this.group.rotation.x = Math.sin(time * 0.53) * 0.18 + boost * 0.28 + stageControl.lift * state.model.summon * 0.12;
    const targetCameraZ = state.model.editor.enabled
      ? state.model.editor.cameraZ
      : state.model.summon > 0.015
        ? MODEL_CONFIG.render.gesture.cameraZ
        : 8;
    this.camera.position.z = lerp(this.camera.position.z, targetCameraZ, state.model.editor.enabled ? 0.18 : 0.05);
    state.model.debug.cameraZ = this.camera.position.z;

    this.rings.forEach((ring, index) => {
      const activeBand = index / this.rings.length < layerPower + 0.12;
      const pulse = Math.sin(time * (1.8 + index * 0.02) + index * 0.34) * 0.5 + 0.5;
      const scale = 1 + pulse * (0.06 + boost * 0.12) + scratch * 0.18;
      ring.scale.setScalar(scale);
      ring.rotation.z += 0.0018 + layerPower * 0.003 + scratch * 0.012;
      ring.material.opacity = activeBand ? 0.13 + pulse * 0.16 + boost * 0.16 : 0.026;
    });

    const trackLevels = [...audioDeck.tracks.values()].map((track) => track.level);
    this.bars.forEach((bar, index) => {
      const level = trackLevels[index % 4] ?? 0;
      const lift = 0.25 + level * 4.8 + layerPower * 0.6 + boost * 1.4;
      bar.scale.y = lerp(bar.scale.y, lift, 0.2);
      bar.material.opacity = 0.28 + level * 1.4 + boost * 0.24;
      bar.position.z = Math.sin(time * 2.4 + index * 0.25) * (0.65 + scratch * 1.4);
    });

    this.modelDeck.render(time, dt);
    this.renderer.render(this.scene, this.camera);
    this.renderBackdrop(time, trackLevels);
  }

  renderBackdrop(time, levels) {
    const width = elements.stage.clientWidth;
    const height = elements.stage.clientHeight;
    backdropContext.clearRect(0, 0, width, height);
    backdropContext.fillStyle = "#050606";
    backdropContext.fillRect(0, 0, width, height);

    const layerPower = state.layerCount / 5;
    const bands = 64;
    for (let i = 0; i < bands; i += 1) {
      const x = (i / (bands - 1)) * width;
      const level = levels[i % Math.max(levels.length, 1)] ?? 0;
      const wave =
        Math.sin(time * 1.8 + i * 0.24) * 42 +
        Math.sin(time * 4.5 + i * 0.1) * 18 * state.scratchEnergy;
      const h = height * (0.16 + layerPower * 0.44 + level * 0.9 + state.boostEnergy * 0.18);
      const hue = i % 3 === 0 ? "#24f0ff" : i % 3 === 1 ? "#ff3f8e" : "#b7ff37";
      backdropContext.globalAlpha = 0.06 + layerPower * 0.09 + level * 0.18;
      backdropContext.fillStyle = hue;
      backdropContext.fillRect(x, height / 2 + wave - h / 2, width / bands + 2, h);
    }

    backdropContext.globalAlpha = 0.18 + state.boostEnergy * 0.16;
    backdropContext.strokeStyle = "#f5f7f4";
    backdropContext.lineWidth = 1;
    for (let y = 0; y < height; y += 28) {
      backdropContext.beginPath();
      backdropContext.moveTo(0, y + Math.sin(time + y * 0.012) * 9);
      backdropContext.lineTo(width, y + Math.cos(time * 0.8 + y * 0.01) * 9);
      backdropContext.stroke();
    }
    backdropContext.globalAlpha = 1;
  }
}

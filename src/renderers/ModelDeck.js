import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MODEL_CONFIG } from "../core/config.js";
import { state } from "../core/state.js";
import { clamp, lerp } from "../core/math.js";
import { pushLog } from "../core/log.js";

export class ModelDeck {
  constructor(scene) {
    this.scene = scene;
    this.loader = new GLTFLoader();
    this.mixer = null;
    this.model = null;
    this.materials = [];
    this.beams = [];

    this.root = new THREE.Group();
    this.root.visible = false;
    this.root.position.set(0, -0.75, -0.25);
    this.scene.add(this.root);

    this.avatarGroup = new THREE.Group();
    this.root.add(this.avatarGroup);

    this.setupEntranceFx();
    this.setupLights();
    this.load();
  }

  setupEntranceFx() {
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x24f0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.summonRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.018, 10, 160), ringMaterial);
    this.summonRing.rotation.x = Math.PI / 2;
    this.summonRing.position.y = -1.02;
    this.root.add(this.summonRing);

    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3f8e,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.scanDisk = new THREE.Mesh(new THREE.CircleGeometry(1.38, 96), gridMaterial);
    this.scanDisk.rotation.x = -Math.PI / 2;
    this.scanDisk.position.y = -1.04;
    this.root.add(this.scanDisk);

    const beamMaterial = new THREE.LineBasicMaterial({
      color: 0x24f0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const radius = index % 2 ? 1.18 : 0.92;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, -1.02, z),
        new THREE.Vector3(x * 0.35, 1.75, z * 0.35),
      ]);
      const beam = new THREE.Line(geometry, beamMaterial.clone());
      this.root.add(beam);
      this.beams.push(beam);
    }
  }

  setupLights() {
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
    keyLight.position.set(1.8, 3.2, 4.4);
    this.scene.add(keyLight);

    const cyanLight = new THREE.PointLight(0x24f0ff, 4.2, 8);
    cyanLight.position.set(-2.4, 0.6, 1.8);
    this.root.add(cyanLight);
    this.cyanLight = cyanLight;

    const pinkLight = new THREE.PointLight(0xff3f8e, 3.6, 8);
    pinkLight.position.set(2.2, 0.1, 1.2);
    this.root.add(pinkLight);
    this.pinkLight = pinkLight;
  }

  load() {
    state.model.loading = true;
    state.model.loaded = false;
    state.model.error = "";
    state.model.progress = 0;
    state.model.progressLabel = "MODEL 0%";
    pushLog("model: loading /3dmodel/just_a_girl.glb");

    this.loader.load(
      MODEL_CONFIG.path,
      (gltf) => {
        this.model = gltf.scene;
        this.prepareModel(this.model);
        this.avatarGroup.add(this.model);

        if (gltf.animations?.length) {
          this.mixer = new THREE.AnimationMixer(this.model);
          gltf.animations.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            action.play();
          });
        }

        state.model.loading = false;
        state.model.loaded = true;
        state.model.progress = 1;
        state.model.progressLabel = "MODEL READY";
        pushLog(`model: ready (${gltf.animations?.length ?? 0} clips)`);
      },
      (event) => {
        const progress = event.total ? clamp(event.loaded / event.total, 0, 1) : 0;
        state.model.progress = progress;
        state.model.progressLabel = event.total
          ? `MODEL ${Math.round(progress * 100)}%`
          : "MODEL STREAM";
      },
      (error) => {
        state.model.loading = false;
        state.model.loaded = false;
        state.model.error = error.message || "load failed";
        state.model.progressLabel = "MODEL ERR";
        pushLog(`model: failed (${state.model.error})`);
      },
    );
  }

  prepareModel(model) {
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    model.position.sub(center);
    model.position.y += size.y * 0.5;
    model.scale.setScalar(2.35 / Math.max(size.y, 0.001));

    model.traverse((child) => {
      if (!child.isMesh) return;
      child.frustumCulled = false;
      const sourceMaterials = (Array.isArray(child.material) ? child.material : [child.material])
        .filter(Boolean);
      if (!sourceMaterials.length) return;
      const nextMaterials = sourceMaterials.map((material) => {
        const next = material.clone();
        next.transparent = true;
        next.opacity = 0;
        if ("emissive" in next) {
          next.emissive = new THREE.Color(0x072c35);
          next.emissiveIntensity = 0.2;
        }
        if ("roughness" in next) next.roughness = Math.min(next.roughness ?? 0.72, 0.62);
        if ("metalness" in next) next.metalness = Math.max(next.metalness ?? 0, 0.08);
        this.materials.push(next);
        return next;
      });
      child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
    });
  }

  render(time, dt) {
    if (this.mixer) this.mixer.update(dt * (0.72 + state.stageControl.energy * 1.35));

    const editMode = state.model.editor.enabled && state.model.loaded;
    const active = (state.stageControl.active && state.model.loaded) || editMode;
    const targetSummon = active ? 1 : 0;
    state.model.summon = lerp(state.model.summon, targetSummon, active ? 0.16 : 0.08);
    const summon = state.model.summon;
    this.root.visible = summon > 0.015 || active;
    if (!this.root.visible) return;

    const control = state.stageControl;
    const editor = state.model.editor;
    const render = MODEL_CONFIG.render;
    const gesture = render.gesture;
    const heightMix = clamp((control.centerY + 1) / 2, 0, 1);
    const twistMix = clamp((control.twist + 1) / 2, 0, 1);
    const gestureScale = gesture.scale;
    const scale = editMode ? editor.scale : gestureScale;

    this.avatarGroup.scale.setScalar(scale);
    this.root.position.x = lerp(this.root.position.x, editMode ? editor.x : gesture.x, editMode ? 0.22 : 0.1);
    this.root.position.y = lerp(this.root.position.y, editMode ? editor.y : lerp(gesture.yFar, gesture.yNear, heightMix), editMode ? 0.22 : 0.1);
    this.root.position.z = lerp(this.root.position.z, editMode ? editor.z : lerp(gesture.zFar, gesture.zNear, control.spread), editMode ? 0.22 : 0.1);
    this.root.rotation.y = lerp(
      this.root.rotation.y,
      editMode ? editor.rotY : lerp(gesture.rotYRightNear, gesture.rotYLeftNear, twistMix),
      editMode ? 0.22 : 0.1,
    );
    this.root.rotation.z = lerp(this.root.rotation.z, editMode ? editor.rotZ : gesture.rotZ, editMode ? 0.22 : 0.1);
    state.model.debug.visible = this.root.visible;
    state.model.debug.scale = scale;
    state.model.debug.x = this.root.position.x;
    state.model.debug.y = this.root.position.y;
    state.model.debug.z = this.root.position.z;
    state.model.debug.rotY = this.root.rotation.y;
    state.model.debug.rotZ = this.root.rotation.z;

    const materialOpacity = clamp(summon * 1.12, 0, 1);
    this.materials.forEach((material) => {
      material.opacity = materialOpacity;
      if ("emissiveIntensity" in material) material.emissiveIntensity = 0.18 + control.energy * 0.65;
    });

    const fxScale = 0.75 + control.spread * 1.25 + summon * 0.85;
    this.summonRing.scale.setScalar(fxScale);
    this.summonRing.rotation.z += 0.018 + control.energy * 0.05;
    this.summonRing.material.opacity = clamp(summon * (0.18 + control.energy * 0.42), 0, 0.75);
    this.scanDisk.scale.setScalar(fxScale * (0.86 + Math.sin(time * 3.4) * 0.04));
    this.scanDisk.material.opacity = clamp(summon * (0.05 + control.energy * 0.18), 0, 0.32);
    this.beams.forEach((beam, index) => {
      beam.rotation.y = time * (0.18 + index * 0.006);
      beam.material.opacity = clamp(summon * (0.08 + control.energy * 0.18) * (index % 3 === 0 ? 1.25 : 1), 0, 0.34);
    });
    this.cyanLight.intensity = 1.4 + summon * (3.4 + control.energy * 2.4);
    this.pinkLight.intensity = 1.1 + summon * (2.8 + control.energy * 2.1);
  }
}

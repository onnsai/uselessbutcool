import { layerDefs } from "../core/config.js";
import { state } from "../core/state.js";
import { clamp, lerp } from "../core/math.js";
import { pushLog } from "../core/log.js";

export class AudioDeck {
  constructor() {
    this.context = null;
    this.master = null;
    this.filter = null;
    this.tracks = new Map();
    this.startedAt = 0;
    this.buffersLoaded = false;
  }

  async init() {
    if (this.context) {
      await this.context.resume();
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.filter = this.context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 18000;
    this.filter.Q.value = 0.8;
    this.filter.connect(this.master);
    this.master.connect(this.context.destination);

    await Promise.all(layerDefs.slice(0, 4).map((layer) => this.loadTrack(layer)));
    this.buffersLoaded = true;
    this.startLoop();
  }

  async loadTrack(layer) {
    const response = await fetch(layer.path);
    if (!response.ok) {
      throw new Error(`${layer.name} load failed: ${response.status}`);
    }
    const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
    const gain = this.context.createGain();
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 128;
    gain.gain.value = 0;
    gain.connect(analyser);
    analyser.connect(this.filter);
    this.tracks.set(layer.id, {
      layer,
      buffer,
      gain,
      analyser,
      data: new Uint8Array(analyser.frequencyBinCount),
      source: null,
      loopStart: clamp(layer.cueStart ?? 0, 0, Math.max(buffer.duration - 0.1, 0)),
      loopEnd: clamp(layer.cueEnd ?? buffer.duration, 0.1, buffer.duration),
      level: 0,
      target: 0,
    });
  }

  startLoop() {
    this.startedAt = this.context.currentTime + 0.08;
    for (const track of this.tracks.values()) {
      const source = this.context.createBufferSource();
      source.buffer = track.buffer;
      source.loop = true;
      source.loopStart = track.loopStart;
      source.loopEnd = track.loopEnd;
      source.connect(track.gain);
      source.start(this.startedAt, track.loopStart);
      track.source = source;
    }
  }

  setCustomFile(layerId, file) {
    const track = this.tracks.get(layerId);
    if (!track || !file || !this.context) return;

    file.arrayBuffer()
      .then((buffer) => this.context.decodeAudioData(buffer))
      .then((buffer) => {
        const previous = track.source;
        track.buffer = buffer;
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
        source.connect(track.gain);
        source.start();
        track.source = source;
        previous?.stop();
        pushLog(`audio: ${track.layer.name} replaced with ${file.name}`);
      })
      .catch((error) => pushLog(`audio: custom stem failed: ${error.message}`));
  }

  update(dt) {
    if (!this.context) return;

    const fxBoost = state.layerCount >= 5 ? state.boostEnergy : 0;
    state.masterVolume = lerp(state.masterVolume, state.targetVolume, 1 - Math.exp(-dt * 14));
    this.master.gain.setTargetAtTime(
      state.masterVolume * (1 + fxBoost * 0.28),
      this.context.currentTime,
      0.018,
    );

    const filterTarget = lerp(6200, 19000, 1 - state.scratchEnergy * 0.7) + fxBoost * 2600;
    this.filter.frequency.setTargetAtTime(filterTarget, this.context.currentTime, 0.018);
    this.filter.Q.setTargetAtTime(0.9 + state.scratchEnergy * 9 + fxBoost * 2, this.context.currentTime, 0.018);

    layerDefs.forEach((layer, index) => {
      const track = this.tracks.get(layer.id);
      if (!track) return;
      const isActive = state.layerCount > index;
      const performanceGate = index === 0 ? 0.88 : 0.76;
      const target = isActive ? performanceGate : 0;
      track.target = lerp(track.target, target, 1 - Math.exp(-dt * 20));
      const tremolo = 1 - state.scratchEnergy * (0.24 + index * 0.06) * (0.5 + Math.sin(state.scratchPhase) * 0.5);
      track.gain.gain.setTargetAtTime(track.target * tremolo, this.context.currentTime, 0.012);

      track.analyser.getByteFrequencyData(track.data);
      const average = track.data.reduce((sum, value) => sum + value, 0) / track.data.length / 255;
      track.level = lerp(track.level, average * track.target, 0.28);
    });
  }
}



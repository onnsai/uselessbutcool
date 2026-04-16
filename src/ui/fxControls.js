import { elements } from "../core/dom.js";
import { state } from "../core/state.js";
import { pushLog } from "../core/log.js";

export function updateFxButtons() {
  elements.glassesToggle.setAttribute("aria-pressed", String(state.glassesEnabled));
  elements.glassesToggle.textContent = state.glassesEnabled ? "Glasses On" : "Glasses Off";
}

export function toggleGlasses() {
  state.glassesEnabled = !state.glassesEnabled;
  pushLog(`face: glasses ${state.glassesEnabled ? "enabled" : "disabled"}`);
  updateFxButtons();
}


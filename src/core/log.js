import { elements } from "./dom.js";

const logThrottle = new Map();

export function pushLog(message, key = message, interval = 0) {
  const now = performance.now();
  if (interval > 0 && now - (logThrottle.get(key) ?? -Infinity) < interval) return;
  logThrottle.set(key, now);
  const stamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const lines = elements.debugLog.textContent.split("\n").filter(Boolean);
  lines.push(`[${stamp}] ${message}`);
  elements.debugLog.textContent = lines.slice(-9).join("\n");
}


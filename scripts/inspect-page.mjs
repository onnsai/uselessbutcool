import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:5173/";
const executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ executablePath, headless: true });

for (const profile of [
  { name: "wide", width: 1680, height: 980 },
  { name: "desktop", width: 1440, height: 1000 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "short-wide", width: 1280, height: 720 },
  { name: "tablet", width: 900, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small-mobile", width: 375, height: 667 },
  { name: "narrow-mobile", width: 360, height: 740 },
]) {
  const page = await browser.newPage({
    viewport: { width: profile.width, height: profile.height },
  });
  const messages = [];
  page.on("console", (message) => messages.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({
    path: `screenshots/playwright-${profile.name}.png`,
    fullPage: false,
  });
  const summary = await page.evaluate(() => {
    const rectOf = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      if (!rect) return null;
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const layout = {
      hud: rectOf(".hud"),
      visual: rectOf(".visual-core"),
      camera: rectOf(".camera-panel"),
      layer: rectOf(".layer-panel"),
      meters: rectOf(".meters"),
      terminal: rectOf(".terminal"),
    };
    const rectsOverlap = (a, b) => {
      if (!a || !b || a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;
      return a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
    };
    const pairs = [
      ["hud", "visual"],
      ["hud", "camera"],
      ["hud", "layer"],
      ["hud", "meters"],
      ["visual", "camera"],
      ["visual", "layer"],
      ["visual", "meters"],
      ["visual", "terminal"],
      ["camera", "meters"],
      ["camera", "terminal"],
      ["layer", "meters"],
      ["layer", "terminal"],
      ["meters", "terminal"],
    ];
    const overlaps = pairs
      .filter(([a, b]) => rectsOverlap(layout[a], layout[b]))
      .map(([a, b]) => `${a}/${b}`);
    return {
      title: document.title,
      layerSlots: [...document.querySelectorAll(".layer-slot strong")].map((node) => node.textContent),
      gesture: document.querySelector("#gestureName")?.textContent,
      hint: document.querySelector("#gestureHint")?.textContent,
      layout,
      overlaps,
    };
  });
  console.log(JSON.stringify({ profile, summary, messages }, null, 2));
  await page.close();
}

await browser.close();

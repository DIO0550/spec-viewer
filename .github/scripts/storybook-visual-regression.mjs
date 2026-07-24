#!/usr/bin/env node
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = () => {
  const [command, ...tokens] = process.argv.slice(2);
  const args = tokens.filter((token) => token !== "--");
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, "");
    const value = args[index + 1];
    if (!key || value === undefined) {
      throw new Error(`Invalid argument near ${args[index] ?? ""}`);
    }
    options[key] = value;
  }
  return { command, options };
};

const listFiles = (dir) => {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
};

const contentType = (path) => {
  const map = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
  return map[extname(path)] ?? "application/octet-stream";
};

const serveStatic = async (root) => {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const decoded = decodeURIComponent(url.pathname);
    const target = join(root, decoded === "/" ? "index.html" : decoded);
    if (!target.startsWith(root) || !existsSync(target) || statSync(target).isDirectory()) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": contentType(target) });
    response.end(readFileSync(target));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start static server");
  }
  return { server, origin: `http://127.0.0.1:${address.port}` };
};

const requestJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${url} failed: ${response.status}`);
  }
  return response.json();
};

const findChrome = () => {
  const candidates = [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  const found = candidates.find((candidate) => spawnSync(candidate, ["--version"], { stdio: "ignore" }).status === 0);
  if (!found) {
    throw new Error("Chrome is required. Install Google Chrome/Chromium or set CHROME_BIN.");
  }
  return found;
};

const openCdp = async (wsUrl) => {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data.toString());
    if (!message.id) {
      return;
    }
    const callbacks = pending.get(message.id);
    if (!callbacks) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      callbacks.reject(new Error(message.error.message));
    } else {
      callbacks.resolve(message.result ?? {});
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  return { send, close: () => socket.close() };
};

const capture = async (options) => {
  const storybookDir = options["storybook-dir"] ?? "storybook-static";
  const out = options.out ?? "visual-actual";
  const width = Number(options.width ?? 1280);
  const height = Number(options.height ?? 720);
  const settleMs = Number(options["settle-ms"] ?? 750);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const { server, origin } = await serveStatic(process.cwd() + `/${storybookDir}`);
  const chrome = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9222", "about:blank"], { stdio: "ignore" });
  try {
    let version;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        version = await requestJson("http://127.0.0.1:9222/json/version");
        break;
      } catch {
        await sleep(100);
      }
    }
    if (!version) {
      throw new Error("Chrome DevTools endpoint did not start");
    }
    const index = await requestJson(`${origin}/index.json`);
    const stories = Object.values(index.entries ?? {}).filter((entry) => entry.type === "story").sort((a, b) => a.id.localeCompare(b.id));
    writeFileSync(join(out, "stories.json"), JSON.stringify(stories.map(({ id, title, name }) => ({ id, title, name })), null, 2));
    for (const story of stories) {
      const target = await requestJson(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`${origin}/iframe.html?id=${story.id}`)}`, { method: "PUT" });
      const cdp = await openCdp(target.webSocketDebuggerUrl);
      await cdp.send("Page.enable");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      await sleep(settleMs);
      const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(join(out, `${story.id}.png`), Buffer.from(screenshot.data, "base64"));
      cdp.close();
      await requestJson(`http://127.0.0.1:9222/json/close/${target.id}`);
      console.log(`captured ${story.id}`);
    }
  } finally {
    chrome.kill("SIGTERM");
    server.close();
  }
};

const run = (cmd, args) => new Promise((resolve) => {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("close", (code) => resolve({ code, stderr }));
});

const copy = (from, to) => writeFileSync(to, readFileSync(from));

const compare = async (options) => {
  const expected = options.expected ?? "visual-baseline";
  const actual = options.actual ?? "visual-actual";
  const out = options.out ?? "visual-report";
  const width = Number(options.width ?? 1280);
  const height = Number(options.height ?? 720);
  const maxDiffRatio = Number(options["max-diff-ratio"] ?? 0.002);
  rmSync(out, { recursive: true, force: true });
  for (const dir of ["actual", "expected", "diff"]) {
    mkdirSync(join(out, dir), { recursive: true });
  }
  const actualNames = listFiles(actual).filter((path) => extname(path) === ".png").map(basename);
  const expectedNames = listFiles(expected).filter((path) => extname(path) === ".png").map(basename);
  const names = [...new Set([...actualNames, ...expectedNames])].sort();
  const results = [];
  for (const name of names) {
    const actualPath = join(actual, name);
    const expectedPath = join(expected, name);
    const diffPath = join(out, "diff", name);
    if (!existsSync(expectedPath)) {
      copy(actualPath, join(out, "actual", name));
      results.push({ story: name.replace(/\.png$/, ""), status: "added", diffPixels: 0, diffRatio: 0, hasExpected: false, hasActual: true, hasDiff: false });
      continue;
    }
    if (!existsSync(actualPath)) {
      copy(expectedPath, join(out, "expected", name));
      results.push({ story: name.replace(/\.png$/, ""), status: "removed", diffPixels: 0, diffRatio: 0, hasExpected: true, hasActual: false, hasDiff: false });
      continue;
    }
    copy(actualPath, join(out, "actual", name));
    copy(expectedPath, join(out, "expected", name));
    const result = await run("compare", ["-metric", "AE", "-highlight-color", "#ff00aa", "-lowlight-color", "#202124", expectedPath, actualPath, diffPath]);
    const diffPixels = Number.parseInt(result.stderr.trim(), 10) || 0;
    const diffRatio = diffPixels / (width * height);
    results.push({ story: name.replace(/\.png$/, ""), status: diffRatio > maxDiffRatio ? "changed" : "passed", diffPixels, diffRatio, hasExpected: true, hasActual: true, hasDiff: true });
  }
  const failed = results.filter((result) => result.status === "changed");
  const summary = { maxDiffRatio, failed: failed.length, results };
  writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(out, "index.html"), renderHtml(summary));
  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const imagePanel = (label, path, enabled) => {
  if (!enabled) {
    return `<div class="image-card image-card--empty"><h3>${label}</h3><p>No image</p></div>`;
  }
  return `<div class="image-card"><h3>${label}</h3><img src="${path}" alt="${label}"></div>`;
};

const comparisonPanel = (result) => {
  if (!result.hasExpected || !result.hasActual) {
    return `<div class="comparison comparison--empty"><p>Slider comparison is unavailable because this story is ${result.status}.</p></div>`;
  }
  const story = escapeHtml(result.story);
  return `<div class="comparison" data-comparison>
    <div class="comparison__frame">
      <img class="comparison__image" src="expected/${story}.png" alt="Expected ${story}">
      <div class="comparison__actual" data-actual style="clip-path: inset(0 0 0 50%)">
        <img class="comparison__image" src="actual/${story}.png" alt="Actual ${story}">
      </div>
      <div class="comparison__handle" data-handle style="left: 50%"></div>
    </div>
    <label class="comparison__control">Before / After
      <input data-slider type="range" min="0" max="100" value="50" aria-label="Before after slider for ${story}">
    </label>
  </div>`;
};

const renderStory = (result) => {
  const story = escapeHtml(result.story);
  const ratio = (result.diffRatio * 100).toFixed(4);
  return `<article class="story story--${result.status}" id="${story}">
    <header class="story__header">
      <div>
        <p class="status">${result.status}</p>
        <h2><a href="#${story}">${story}</a></h2>
      </div>
      <dl class="metrics">
        <div><dt>Diff pixels</dt><dd>${result.diffPixels}</dd></div>
        <div><dt>Diff ratio</dt><dd>${ratio}%</dd></div>
      </dl>
    </header>
    ${comparisonPanel(result)}
    <div class="shots">
      ${imagePanel("Expected", `expected/${story}.png`, result.hasExpected)}
      ${imagePanel("Actual", `actual/${story}.png`, result.hasActual)}
      ${imagePanel("Diff", `diff/${story}.png`, result.hasDiff)}
    </div>
  </article>`;
};

const renderHtml = (summary) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Storybook Visual Regression Report</title>
  <style>
    :root { color-scheme: light dark; --bg: #0f172a; --panel: #111827; --text: #e5e7eb; --muted: #9ca3af; --line: #374151; --accent: #38bdf8; --danger: #fb7185; --ok: #34d399; --warn: #fbbf24; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(1440px, calc(100% - 48px)); margin: 0 auto; padding: 32px 0 56px; }
    .hero { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-bottom: 24px; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 32px; }
    a { color: inherit; }
    .summary { color: var(--muted); margin-top: 8px; }
    .badge { border: 1px solid var(--line); border-radius: 999px; padding: 8px 12px; background: rgb(255 255 255 / 6%); }
    .story { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 20px; margin-top: 18px; box-shadow: 0 18px 50px rgb(0 0 0 / 24%); }
    .story--changed { border-color: rgb(251 113 133 / 70%); }
    .story--passed { border-color: rgb(52 211 153 / 45%); }
    .story__header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
    .status { display: inline-block; color: var(--bg); background: var(--warn); border-radius: 999px; padding: 3px 9px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
    .story--changed .status { background: var(--danger); }
    .story--passed .status { background: var(--ok); }
    .metrics { display: flex; gap: 12px; margin: 0; }
    .metrics div { min-width: 110px; border: 1px solid var(--line); border-radius: 12px; padding: 10px; }
    dt { color: var(--muted); font-size: 12px; }
    dd { margin: 4px 0 0; font-weight: 700; }
    .comparison { margin-bottom: 18px; }
    .comparison__frame { position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: 14px; background: #020617; }
    .comparison__image { display: block; width: 100%; height: auto; user-select: none; }
    .comparison__actual { position: absolute; inset: 0; overflow: hidden; }
    .comparison__handle { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--accent); box-shadow: 0 0 0 9999px rgb(56 189 248 / 0%); }
    .comparison__handle::after { content: ""; position: absolute; top: 50%; left: 50%; width: 28px; height: 28px; border: 2px solid var(--accent); border-radius: 999px; background: var(--panel); transform: translate(-50%, -50%); box-shadow: 0 4px 16px rgb(0 0 0 / 35%); }
    .comparison__control { display: grid; gap: 8px; margin-top: 10px; color: var(--muted); font-size: 13px; }
    input[type="range"] { width: 100%; accent-color: var(--accent); }
    .comparison--empty { border: 1px dashed var(--line); border-radius: 14px; padding: 24px; color: var(--muted); }
    .shots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .image-card { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: #020617; }
    .image-card h3 { padding: 10px 12px; font-size: 13px; color: var(--muted); border-bottom: 1px solid var(--line); }
    .image-card img { display: block; width: 100%; height: auto; }
    .image-card--empty { display: grid; min-height: 180px; place-items: center; color: var(--muted); }
    .image-card--empty h3 { justify-self: stretch; width: 100%; box-sizing: border-box; }
    @media (max-width: 900px) { main { width: min(100% - 24px, 1440px); } .hero, .story__header { display: block; } .metrics, .shots { grid-template-columns: 1fr; display: grid; } }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div>
        <h1>Storybook Visual Regression Report</h1>
        <p class="summary">Move the slider to compare baseline and current screenshots. Open the diff panel for highlighted pixel changes.</p>
      </div>
      <div class="badge">Failed: <strong>${summary.failed}</strong> / Threshold: ${summary.maxDiffRatio}</div>
    </section>
    ${summary.results.map(renderStory).join("")}
  </main>
  <script>
    for (const root of document.querySelectorAll("[data-comparison]")) {
      const slider = root.querySelector("[data-slider]");
      const actual = root.querySelector("[data-actual]");
      const handle = root.querySelector("[data-handle]");
      const update = () => {
        const value = slider.value;
        actual.style.clipPath = "inset(0 0 0 " + value + "%)";
        handle.style.left = value + "%";
      };
      slider.addEventListener("input", update);
      update();
    }
  </script>
</body>
</html>`;

const { command, options } = parseArgs();
if (command === "capture") {
  await capture(options);
} else if (command === "compare") {
  await compare(options);
} else {
  throw new Error("Usage: storybook-visual-regression.mjs <capture|compare> [--key value]");
}

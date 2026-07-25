#!/usr/bin/env node
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

const requestOk = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${url} failed: ${response.status}`);
  }
  await response.arrayBuffer();
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
  // Chrome 136+ は remote debugging に非デフォルトの user-data-dir が必須。
  const userDataDir = mkdtempSync(join(tmpdir(), "storybook-visual-chrome-"));
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--remote-debugging-port=9222",
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
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
      await requestOk(`http://127.0.0.1:9222/json/close/${target.id}`);
      console.log(`captured ${story.id}`);
    }
  } finally {
    chrome.kill("SIGTERM");
    await sleep(250);
    try {
      chrome.kill("SIGKILL");
    } catch {
      // already exited
    }
    server.close();
    // Chrome 終了直後は user-data-dir がまだ書き込み中のことがあるためリトライする。
    // それでも残った場合はキャプチャ自体は成功しているので握りつぶす。
    try {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch (error) {
      console.warn(`failed to remove chrome user data dir: ${userDataDir}`, error);
    }
  }
};

const run = (cmd, args) => new Promise((resolve) => {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("close", (code) => resolve({ code, stderr }));
});

const copy = (from, to) => writeFileSync(to, readFileSync(from));

const readStoryMetadata = (dir) => {
  const path = join(dir, "stories.json");
  if (!existsSync(path)) {
    return new Map();
  }
  const stories = JSON.parse(readFileSync(path, "utf8"));
  return new Map(stories.map((story) => [story.id, story]));
};

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
  const actualNames = listFiles(actual).filter((path) => extname(path) === ".png").map((path) => basename(path));
  const expectedNames = listFiles(expected).filter((path) => extname(path) === ".png").map((path) => basename(path));
  const storyMetadata = new Map([...readStoryMetadata(expected), ...readStoryMetadata(actual)]);
  const names = [...new Set([...actualNames, ...expectedNames])].sort();
  const results = [];
  for (const name of names) {
    const actualPath = join(actual, name);
    const expectedPath = join(expected, name);
    const diffPath = join(out, "diff", name);
    if (!existsSync(expectedPath)) {
      copy(actualPath, join(out, "actual", name));
      const story = name.replace(/\.png$/, "");
      results.push({ story, ...storyMetadata.get(story), status: "added", diffPixels: 0, diffRatio: 0, hasExpected: false, hasActual: true, hasDiff: false });
      continue;
    }
    if (!existsSync(actualPath)) {
      copy(expectedPath, join(out, "expected", name));
      const story = name.replace(/\.png$/, "");
      results.push({ story, ...storyMetadata.get(story), status: "removed", diffPixels: 0, diffRatio: 0, hasExpected: true, hasActual: false, hasDiff: false });
      continue;
    }
    copy(actualPath, join(out, "actual", name));
    copy(expectedPath, join(out, "expected", name));
    const result = await run("compare", ["-metric", "AE", "-highlight-color", "#ff00aa", "-lowlight-color", "#202124", expectedPath, actualPath, diffPath]);
    const diffPixels = Number.parseInt(result.stderr.trim(), 10) || 0;
    const diffRatio = diffPixels / (width * height);
    const story = name.replace(/\.png$/, "");
    results.push({ story, ...storyMetadata.get(story), status: diffRatio > maxDiffRatio ? "changed" : "passed", diffPixels, diffRatio, hasExpected: true, hasActual: true, hasDiff: true });
  }
  const failed = results.filter((result) => result.status === "changed");
  const summary = { maxDiffRatio, failed: failed.length, results };
  writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(out, "index.html"), renderHtml(summary));
  for (const result of results) {
    const storyDir = join(out, result.story);
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(join(storyDir, "index.html"), renderHtml({ ...summary, results: [result] }, { detailStory: result.story, pathPrefix: "../" }));
  }
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

const comparisonPanel = (result, pathPrefix = "") => {
  if (!result.hasExpected || !result.hasActual) {
    return `<div class="comparison comparison--empty"><p>Slider comparison is unavailable because this story is ${result.status}.</p></div>`;
  }
  const story = escapeHtml(result.story);
  return `<div class="comparison" data-comparison>
    <div class="comparison__frame">
      <img class="comparison__image" src="${pathPrefix}expected/${story}.png" alt="Expected ${story}">
      <div class="comparison__actual" data-actual style="clip-path: inset(0 0 0 50%)">
        <img class="comparison__image" src="${pathPrefix}actual/${story}.png" alt="Actual ${story}">
      </div>
      <div class="comparison__handle" data-handle style="left: 50%"></div>
    </div>
    <label class="comparison__control">Before / After
      <input data-slider type="range" min="0" max="100" value="50" aria-label="Before after slider for ${story}">
    </label>
  </div>`;
};

const renderStory = (result, options = {}) => {
  const story = escapeHtml(result.story);
  const ratio = (result.diffRatio * 100).toFixed(4);
  const pathPrefix = options.pathPrefix ?? "";
  const titleHref = options.detailStory ? `${pathPrefix}index.html#${story}` : `${story}/`;
  const storyLinkAttribute = options.detailStory ? "" : ` data-story-link="${story}"`;
  return `<article class="story story--${result.status}" id="${story}">
    <header class="story__header">
      <div>
        <p class="status">${result.status}</p>
        <h2><a href="${titleHref}"${storyLinkAttribute}>${story}</a></h2>
      </div>
      <dl class="metrics">
        <div><dt>Diff pixels</dt><dd>${result.diffPixels}</dd></div>
        <div><dt>Diff ratio</dt><dd>${ratio}%</dd></div>
      </dl>
    </header>
    ${comparisonPanel(result, pathPrefix)}
    <div class="shots">
      ${imagePanel("Expected", `${pathPrefix}expected/${story}.png`, result.hasExpected)}
      ${imagePanel("Actual", `${pathPrefix}actual/${story}.png`, result.hasActual)}
      ${imagePanel("Diff", `${pathPrefix}diff/${story}.png`, result.hasDiff)}
    </div>
  </article>`;
};

const formatStatusLabel = (status) => {
  if (status === "passed") {
    return "Clear";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const renderStoryTree = (stories) => {
  const root = { children: new Map(), stories: [] };
  for (const result of stories) {
    const titleParts = (result.title ?? "Other").split("/").filter(Boolean);
    let node = root;
    for (const part of titleParts) {
      if (!node.children.has(part)) {
        node.children.set(part, { children: new Map(), stories: [] });
      }
      node = node.children.get(part);
    }
    node.stories.push(result);
  }

  const renderNode = (node) => `${[...node.children.entries()].map(([label, child]) => `<li>
    <details open>
      <summary>${escapeHtml(label)}</summary>
      <ul>${renderNode(child)}</ul>
    </details>
  </li>`).join("")}${node.stories.map((result) => {
    const story = escapeHtml(result.story);
    const label = escapeHtml(result.name ?? result.story.split("--").at(-1) ?? result.story);
    return `<li class="story-nav__story"><a href="#${story}" title="${story}">${label}</a></li>`;
  }).join("")}`;

  return `<ul class="story-nav__tree">${renderNode(root)}</ul>`;
};

const renderSidebar = (summary, options = {}) => {
  if (options.detailStory) {
    return "";
  }
  const groups = ["changed", "added", "removed", "passed"]
    .map((status) => ({
      status,
      stories: summary.results.filter((result) => result.status === status),
    }))
    .filter((group) => group.stories.length > 0);

  if (groups.length === 0) {
    return "";
  }

  return `<aside class="story-nav" id="story-navigation" aria-label="Story result navigation">
    <h2>Stories</h2>
    ${groups.map((group) => `<section class="story-nav__group story-nav__group--${group.status}">
      <h3>${formatStatusLabel(group.status)} <span>${group.stories.length}</span></h3>
      ${renderStoryTree(group.stories)}
    </section>`).join("")}
  </aside>`;
};

const renderHtml = (summary, options = {}) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${options.detailStory ? `${escapeHtml(options.detailStory)} - ` : ""}Storybook Visual Regression Report</title>
  <style>
    :root { color-scheme: light dark; --bg: #0f172a; --panel: #111827; --text: #e5e7eb; --muted: #9ca3af; --line: #374151; --accent: #38bdf8; --danger: #fb7185; --ok: #34d399; --warn: #fbbf24; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .layout { display: grid; grid-template-columns: minmax(240px, 300px) minmax(0, 1fr); gap: 24px; width: min(1680px, calc(100% - 48px)); margin: 0 auto; padding: 32px 0 56px; transition: grid-template-columns 160ms ease; }
    .layout--nav-hidden { grid-template-columns: 0 minmax(0, 1fr); }
    .layout--nav-hidden .story-nav { visibility: hidden; opacity: 0; pointer-events: none; }
    .layout--detail { display: block; width: min(1440px, calc(100% - 48px)); }
    main { min-width: 0; }
    .hero { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-bottom: 24px; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 32px; }
    a { color: inherit; }
    .summary { color: var(--muted); margin-top: 8px; }
    .hero__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .badge, .nav-toggle { border: 1px solid var(--line); border-radius: 999px; padding: 8px 12px; background: rgb(255 255 255 / 6%); color: var(--text); font: inherit; }
    .nav-toggle { cursor: pointer; }
    .nav-toggle:hover { border-color: var(--accent); color: var(--accent); }
    .story-nav { position: sticky; top: 24px; align-self: start; box-sizing: border-box; max-height: calc(100vh - 48px); overflow: auto; scrollbar-gutter: stable; border: 1px solid var(--line); border-radius: 18px; padding: 16px 20px 16px 16px; background: rgb(17 24 39 / 86%); box-shadow: 0 18px 50px rgb(0 0 0 / 18%); transition: opacity 160ms ease; }
    .story-nav h2 { font-size: 16px; margin: 0 0 14px; }
    .story-nav__group { margin-top: 14px; }
    .story-nav__group h3 { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 8px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .story-nav__group h3 span { border: 1px solid var(--line); border-radius: 999px; padding: 1px 7px; color: var(--text); background: rgb(255 255 255 / 6%); }
    .story-nav__group--changed h3 { color: var(--danger); }
    .story-nav__group--passed h3 { color: var(--ok); }
    .story-nav ul { list-style: none; margin: 0; padding: 0; }
    .story-nav__tree ul { margin-left: 9px; padding-left: 10px; border-left: 1px solid var(--line); }
    .story-nav details > summary { overflow: hidden; padding: 5px 4px; cursor: pointer; color: var(--muted); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .story-nav details > summary:hover { color: var(--accent); }
    .story-nav__story { margin: 2px 0; }
    .story-nav a { display: block; overflow: hidden; border-radius: 8px; padding: 6px 8px; color: var(--text); text-overflow: ellipsis; white-space: nowrap; text-decoration: none; }
    .story-nav a:hover { background: rgb(255 255 255 / 8%); color: var(--accent); }
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
    @media (max-width: 900px) { .hero, .story__header { display: block; } .hero__actions { justify-content: flex-start; margin-top: 12px; } .metrics, .shots { grid-template-columns: 1fr; display: grid; } }
    @media (max-width: 640px) { .layout, .layout--detail, .layout--nav-hidden { display: block; width: min(100% - 24px, 1440px); padding-top: 18px; } .story-nav { position: static; max-height: 60vh; margin-bottom: 18px; } .layout--nav-hidden .story-nav { display: none; } }
  </style>
</head>
<body>
  <div class="layout${options.detailStory ? " layout--detail" : ""}" data-layout>
  ${renderSidebar(summary, options)}
  <main>
    <section class="hero">
      <div>
        <h1>${options.detailStory ? escapeHtml(options.detailStory) : "Storybook Visual Regression Report"}</h1>
        <p class="summary">${options.detailStory ? '<a href="../" data-back-link>← Back to all stories</a>' : "Move the slider to compare baseline and current screenshots. Click a story title to open that story on its own page."}</p>
      </div>
      <div class="hero__actions">
        ${options.detailStory ? "" : '<button class="nav-toggle" type="button" data-nav-toggle aria-controls="story-navigation" aria-expanded="true">Hide stories</button>'}
        <div class="badge">Failed: <strong>${summary.failed}</strong> / Threshold: ${summary.maxDiffRatio}</div>
      </div>
    </section>
    ${summary.results.map((result) => renderStory(result, options)).join("")}
  </main>
  </div>
  <script>
    const layout = document.querySelector("[data-layout]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    if (layout && navToggle) {
      navToggle.addEventListener("click", () => {
        const hidden = layout.classList.toggle("layout--nav-hidden");
        navToggle.setAttribute("aria-expanded", String(!hidden));
        navToggle.textContent = hidden ? "Show stories" : "Hide stories";
      });
    }
    const currentDirectory = () => window.location.pathname.endsWith("/") ? window.location.pathname : window.location.pathname + "/";
    for (const link of document.querySelectorAll("[data-story-link]")) {
      const story = link.getAttribute("data-story-link");
      if (story) {
        link.href = currentDirectory() + encodeURIComponent(story) + "/";
      }
    }
    for (const link of document.querySelectorAll("[data-back-link]")) {
      const path = window.location.pathname.endsWith("/") ? window.location.pathname.slice(0, -1) : window.location.pathname;
      link.href = path.slice(0, path.lastIndexOf("/")) + "/";
    }
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

# Holistic Tracking Web Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static single-page website that runs MediaPipe pose + hand + face tracking live on the visitor's webcam, in a technical/instrument aesthetic, then commit to GitHub and deploy to Vercel.

**Architecture:** Three zero-build files in `web/` (`index.html`, `style.css`, `app.js`). `app.js` is an ES module that imports `@mediapipe/tasks-vision` from CDN, creates three landmarkers in VIDEO mode, runs a `requestAnimationFrame` inference loop, and renders landmark overlays onto a `<canvas>` stacked over a `<video>`. All client-side; no backend.

**Tech Stack:** HTML/CSS/vanilla JS (ES modules), MediaPipe Tasks Vision (WASM) from jsDelivr CDN, Playwright (verification only), Vercel (static hosting).

## Global Constraints

- Zero build step. No bundler, no npm install for the app itself. Files must open and run from a static server.
- Exactly three app files under `web/`: `index.html`, `style.css`, `app.js`. (Design-iteration may add throwaway `web/themes/*.css` that are deleted before final commit; the winning theme is folded back into `style.css`.)
- MediaPipe pinned to a specific version: `@mediapipe/tasks-vision@0.10.18` (CDN, ESM + WASM fileset must use the same version).
- Model URLs (verbatim, same as `body_tracking.py`):
  - pose: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`
  - hand: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`
  - face: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task`
- Landmarker counts: `numPoses: 1`, `numHands: 2`, `numFaces: 1`.
- Aesthetic lane is fixed: technical/instrument (dark, monospace accents, fine grid, HUD readouts). Iteration varies execution only, never the lane.
- Mirror defaults ON (matches Python `cv2.flip`). Video and canvas are flipped together via CSS so overlay coordinates need no per-point flip.
- Privacy copy must appear in the footer, verbatim: `Runs entirely in your browser — no video ever leaves your device.`
- Wordmark in the header, verbatim: `HOLISTIC.TRACK`.

---

## File Structure

- `web/index.html` — markup: header bar, feed pane (video+canvas+grid+corner ticks), side rail (readouts + switches), footer. Loads `style.css` and `app.js` (module).
- `web/style.css` — all styling: instrument theme, layout, switches, states.
- `web/app.js` — all logic, organized into named sections: constants (connections/colors), camera, model loader, inference loop, renderer, HUD wiring, state machine.
- `web/vercel.json` — static config (or rely on zero-config; created in Task 8).
- `web/themes/*.css` — throwaway design-iteration variants (Task 7 only; deleted before Task 9).

The app is small enough that one `app.js` is the right boundary: the units (camera, loader, loop, renderer, hud) share the same DOM and state object and change together. They are separated by clearly-commented sections and a single `state` object, not by file.

---

## Verification approach

This is a webcam + WASM browser demo. Pure-logic helpers are unit-tested with Node's built-in test runner (no install, no build). Everything camera/visual is verified in a real browser, and UI states that don't need a real camera are verified with Playwright using a fake media stream. Each task states its exact verification.

---

### Task 1: Scaffold `web/` and the instrument shell

**Files:**
- Create: `web/index.html`
- Create: `web/style.css`
- Create: `web/app.js`

**Interfaces:**
- Produces: the DOM contract every later task depends on. Element IDs:
  `#feed` (video), `#overlay` (canvas), `#startBtn`, `#status`, `#fps`,
  `#points`, `#modelStatus`, `#tgPose`, `#tgHand`, `#tgFace`, `#tgMirror`,
  `#errBox`. CSS class `is-mirrored` applied to `#stage` toggles the flip.

- [ ] **Step 1: Write `web/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HOLISTIC.TRACK — live full-body tracking</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="bar">
    <span class="wordmark">HOLISTIC.TRACK</span>
    <span class="status" id="status" data-state="idle">● IDLE</span>
  </header>

  <main class="panel">
    <section class="feed">
      <div class="stage" id="stage">
        <video id="feed" playsinline muted></video>
        <canvas id="overlay"></canvas>
        <div class="grid" aria-hidden="true"></div>
        <div class="ticks" aria-hidden="true"></div>
        <div class="err" id="errBox" hidden></div>
      </div>
      <div class="controls">
        <button id="startBtn" class="primary">START CAMERA</button>
      </div>
    </section>

    <aside class="rail">
      <div class="readout"><span class="k">FPS</span><span class="v" id="fps">--</span></div>
      <div class="readout"><span class="k">POINTS</span><span class="v" id="points">0</span></div>
      <div class="readout"><span class="k">MODELS</span><span class="v" id="modelStatus">cold</span></div>
      <div class="switches">
        <label class="sw"><input type="checkbox" id="tgPose" checked /> <span>POSE</span></label>
        <label class="sw"><input type="checkbox" id="tgHand" checked /> <span>HANDS</span></label>
        <label class="sw"><input type="checkbox" id="tgFace" checked /> <span>FACE</span></label>
        <label class="sw"><input type="checkbox" id="tgMirror" checked /> <span>MIRROR</span></label>
      </div>
    </aside>
  </main>

  <footer class="foot">
    <span>Runs entirely in your browser — no video ever leaves your device.</span>
    <a id="repoLink" href="#" target="_blank" rel="noreferrer">GitHub</a>
  </footer>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write a minimal `web/style.css` (placeholder instrument theme; refined in Task 6/7)**

```css
:root{ --bg:#0a0c10; --panel:#0e1117; --line:#1b2430; --ink:#c9d4e3; --dim:#5d6b7e; --accent:#3fe0c5; --mono:"DejaVu Sans Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:var(--mono)}
.bar{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid var(--line)}
.wordmark{letter-spacing:.18em;font-weight:700}
.status{font-size:12px;color:var(--dim)}
.status[data-state="running"]{color:var(--accent)}
.panel{display:grid;grid-template-columns:1fr 220px;gap:18px;padding:18px;align-items:start}
.stage{position:relative;aspect-ratio:4/3;background:#05070a;border:1px solid var(--line);overflow:hidden}
#feed,#overlay{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.stage.is-mirrored #feed,.stage.is-mirrored #overlay{transform:scaleX(-1)}
.grid{position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:40px 40px;opacity:.25;pointer-events:none}
.err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:#ff7a7a;background:rgba(5,7,10,.85)}
.controls{margin-top:12px}
.primary{font-family:var(--mono);background:var(--accent);color:#04110d;border:0;padding:10px 16px;letter-spacing:.1em;cursor:pointer}
.primary:disabled{opacity:.5;cursor:wait}
.rail{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);padding:14px}
.readout{display:flex;justify-content:space-between;font-size:13px;border-bottom:1px dashed var(--line);padding-bottom:6px}
.readout .k{color:var(--dim)}
.switches{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.sw{display:flex;align-items:center;gap:8px;font-size:13px}
.foot{display:flex;justify-content:space-between;color:var(--dim);font-size:12px;padding:12px 18px;border-top:1px solid var(--line)}
.foot a{color:var(--accent)}
@media(max-width:760px){.panel{grid-template-columns:1fr}}
```

- [ ] **Step 3: Write a placeholder `web/app.js`**

```js
// Holistic Tracking — app entry. Filled in across later tasks.
console.log("HOLISTIC.TRACK boot");
```

- [ ] **Step 4: Serve and verify the shell renders**

Run: `cd web && python3 -m http.server 8000`
Then open `http://localhost:8000/` in a browser.
Expected: header `HOLISTIC.TRACK`, an empty dark feed pane with a faint grid, a START CAMERA button, the side rail with FPS/POINTS/MODELS and four switches, and the footer privacy line. Console logs `HOLISTIC.TRACK boot`. No layout overflow.

- [ ] **Step 5: Commit**

```bash
git add web/index.html web/style.css web/app.js
git commit -m "feat(web): scaffold instrument shell for holistic tracking demo"
```

---

### Task 2: Connection topology + pure helpers (unit-tested)

**Files:**
- Create: `web/lib/geometry.mjs`
- Test: `web/lib/geometry.test.mjs`

**Interfaces:**
- Produces:
  - `POSE_CONNECTIONS: [number, number][]` — 35 edges, exact list from `body_tracking.py`.
  - `HAND_CONNECTIONS: [number, number][]` — 21 edges, exact list from `body_tracking.py`.
  - `toPixel(landmark, width, height) -> {x:number, y:number}` — normalized → pixel (rounded).
  - `rollingFps(samples, now) -> number` — given an array of recent frame timestamps (ms) including `now`, returns rounded FPS over the window; returns 0 if fewer than 2 samples.
  - `countPoints(results, flags) -> number` — total landmarks across enabled layers.

- [ ] **Step 1: Write the failing test**

```js
// web/lib/geometry.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { POSE_CONNECTIONS, HAND_CONNECTIONS, toPixel, rollingFps, countPoints } from "./geometry.mjs";

test("connection counts match the Python topology", () => {
  assert.equal(POSE_CONNECTIONS.length, 35);
  assert.equal(HAND_CONNECTIONS.length, 21);
});

test("connections are valid index pairs", () => {
  for (const [a, b] of [...POSE_CONNECTIONS, ...HAND_CONNECTIONS]) {
    assert.equal(typeof a, "number");
    assert.equal(typeof b, "number");
    assert.notEqual(a, b);
  }
});

test("toPixel scales and rounds normalized coords", () => {
  assert.deepEqual(toPixel({ x: 0.5, y: 0.25 }, 640, 480), { x: 320, y: 120 });
});

test("rollingFps returns 0 for <2 samples and a rate otherwise", () => {
  assert.equal(rollingFps([], 1000), 0);
  // 4 frames spanning 50ms => 3 intervals over 0.05s => 60 fps
  assert.equal(rollingFps([1000, 1016.67, 1033.33, 1050], 1050), 60);
});

test("countPoints sums only enabled layers", () => {
  const results = {
    pose: { landmarks: [Array(33).fill({})] },
    hand: { landmarks: [Array(21).fill({}), Array(21).fill({})] },
    face: { faceLandmarks: [Array(478).fill({})] },
  };
  assert.equal(countPoints(results, { pose: true, hand: false, face: false }), 33);
  assert.equal(countPoints(results, { pose: true, hand: true, face: false }), 33 + 42);
  assert.equal(countPoints(results, { pose: false, hand: false, face: true }), 478);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/lib/geometry.test.mjs`
Expected: FAIL — `Cannot find module './geometry.mjs'`.

- [ ] **Step 3: Write `web/lib/geometry.mjs`**

```js
// Pure geometry/metrics helpers. No DOM, no MediaPipe — unit-testable in Node.

// Exact topology from body_tracking.py
export const POSE_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],
  [9,10],[11,12],[11,13],[13,15],[15,17],[15,19],[15,21],
  [17,19],[12,14],[14,16],[16,18],[16,20],[16,22],[18,20],
  [11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28],
  [27,29],[28,30],[29,31],[30,32],[27,31],[28,32],
];

export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

export function toPixel(landmark, width, height) {
  return { x: Math.round(landmark.x * width), y: Math.round(landmark.y * height) };
}

export function rollingFps(samples, now) {
  if (!samples || samples.length < 2) return 0;
  const span = now - samples[0];
  if (span <= 0) return 0;
  return Math.round(((samples.length - 1) / span) * 1000);
}

export function countPoints(results, flags) {
  let n = 0;
  if (flags.pose && results.pose?.landmarks) for (const l of results.pose.landmarks) n += l.length;
  if (flags.hand && results.hand?.landmarks) for (const l of results.hand.landmarks) n += l.length;
  if (flags.face && results.face?.faceLandmarks) for (const l of results.face.faceLandmarks) n += l.length;
  return n;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/lib/geometry.test.mjs`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add web/lib/geometry.mjs web/lib/geometry.test.mjs
git commit -m "feat(web): add tested geometry + metrics helpers matching Python topology"
```

---

### Task 3: Camera module + state machine

**Files:**
- Modify: `web/app.js` (replace placeholder)

**Interfaces:**
- Consumes: DOM IDs from Task 1.
- Produces: a `state` object `{ running:boolean, flags:{pose,hand,face}, mirror:boolean }`; functions `setStatus(name)`, `showError(msg)`, `startCamera()`, `stopCamera()`. `startCamera` resolves once `#feed` has live video metadata.

- [ ] **Step 1: Replace `web/app.js` with the camera + state layer**

```js
// HOLISTIC.TRACK — main module
const el = (id) => document.getElementById(id);
const stage = el("stage");
const video = el("feed");
const startBtn = el("startBtn");
const statusEl = el("status");
const errBox = el("errBox");

const state = {
  running: false,
  flags: { pose: true, hand: true, face: true },
  mirror: true,
  stream: null,
};

function setStatus(name) {
  statusEl.dataset.state = name;
  statusEl.textContent = name === "running" ? "● LIVE" : name === "loading" ? "● LOADING" : "● IDLE";
}

function showError(msg) {
  errBox.hidden = false;
  errBox.textContent = msg;
}
function clearError() { errBox.hidden = true; errBox.textContent = ""; }

async function startCamera() {
  clearError();
  startBtn.disabled = true;
  setStatus("loading");
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    video.srcObject = state.stream;
    await video.play();
    await new Promise((res) => {
      if (video.readyState >= 2) return res();
      video.onloadeddata = () => res();
    });
  } catch (e) {
    setStatus("idle");
    startBtn.disabled = false;
    showError(e?.name === "NotAllowedError"
      ? "Camera permission denied. Allow access and press START again."
      : "No camera available or it is in use by another app.");
    throw e;
  }
}

function stopCamera() {
  state.running = false;
  if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
  video.srcObject = null;
  setStatus("idle");
  startBtn.textContent = "START CAMERA";
  startBtn.disabled = false;
}

// Wiring is completed in later tasks; expose for them.
export { state, video, stage, startBtn, setStatus, showError, clearError, startCamera, stopCamera, el };
```

> Note: because `app.js` is loaded as a module and also needs to self-run, the
> final wiring (button click → start) lands in Task 6. For now this module only
> defines behavior.

- [ ] **Step 2: Temporary manual check**

Add at the bottom of `app.js`, temporarily:
```js
startBtn.addEventListener("click", () => startCamera().catch(() => {}));
```
Run: `cd web && python3 -m http.server 8000`, open `http://localhost:8000/`, click START CAMERA.
Expected: browser asks for camera permission; on allow, the live feed appears mirrored; status shows `● LOADING` (no loop yet). On deny, the error overlay shows the permission message and status returns to `● IDLE`.

- [ ] **Step 3: Remove the temporary listener**

Delete the temporary line added in Step 2 (Task 6 adds the real wiring).

- [ ] **Step 4: Commit**

```bash
git add web/app.js
git commit -m "feat(web): camera lifecycle, error states, and app state machine"
```

---

### Task 4: Model loader (MediaPipe tasks-vision from CDN)

**Files:**
- Modify: `web/app.js`

**Interfaces:**
- Consumes: `setStatus`, `el` from Task 3.
- Produces: `async loadModels() -> { pose, hand, face }` returning the three landmarker instances; updates `#modelStatus` (`cold` → `loading…` → `ready`). Idempotent: returns cached landmarkers if already loaded.

- [ ] **Step 1: Add the loader near the top of `app.js` (after the imports/`el` helper)**

```js
import {
  FilesetResolver, PoseLandmarker, HandLandmarker, FaceLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";

const MODEL_URLS = {
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
};

let _models = null;
async function loadModels() {
  if (_models) return _models;
  const modelStatus = el("modelStatus");
  modelStatus.textContent = "loading…";
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
  );
  const [pose, hand, face] = await Promise.all([
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URLS.pose, delegate: "GPU" },
      runningMode: "VIDEO", numPoses: 1,
    }),
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URLS.hand, delegate: "GPU" },
      runningMode: "VIDEO", numHands: 2,
    }),
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URLS.face, delegate: "GPU" },
      runningMode: "VIDEO", numFaces: 1,
    }),
  ]);
  _models = { pose, hand, face };
  modelStatus.textContent = "ready";
  return _models;
}
```

Add `loadModels` to the `export { ... }` list at the bottom.

- [ ] **Step 2: Verify the import + load resolve (no inference yet)**

Temporarily append:
```js
startBtn.addEventListener("click", async () => { try { await loadModels(); console.log("models ready"); } catch (e) { console.error(e); } });
```
Run the static server, open the page, click START CAMERA, watch the console and the MODELS readout.
Expected: `#modelStatus` goes `cold → loading… → ready`; console logs `models ready` within a few seconds (first load downloads WASM + 3 `.task` files). No CORS or 404 errors in the console.

- [ ] **Step 3: Remove the temporary listener.**

- [ ] **Step 4: Commit**

```bash
git add web/app.js
git commit -m "feat(web): load pose/hand/face landmarkers from MediaPipe CDN"
```

---

### Task 5: Inference loop + renderer

**Files:**
- Modify: `web/app.js`

**Interfaces:**
- Consumes: `state`, `video`, `loadModels`, `POSE_CONNECTIONS`, `HAND_CONNECTIONS`, `toPixel`, `rollingFps`, `countPoints`.
- Produces: `startLoop()` / `loop()` driving detection + draw; updates `#fps` and `#points`. Renderer draws to `#overlay`.

- [ ] **Step 1: Add imports from the geometry lib at the top of `app.js`**

```js
import { POSE_CONNECTIONS, HAND_CONNECTIONS, toPixel, rollingFps, countPoints } from "./lib/geometry.mjs";
```

- [ ] **Step 2: Add the renderer + loop**

```js
const canvas = el("overlay");
const ctx = canvas.getContext("2d");
const fpsEl = el("fps");
const pointsEl = el("points");

const COLORS = {
  poseLine: "#f57542", posePoint: "#f542e6",
  handLine: "#791b4c", handPoint: "#792cfa",
  facePoint: "#50dc78",
};

function syncCanvas() {
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

function drawConnected(landmarks, connections, lineColor, pointColor, pointRadius = 4) {
  const w = canvas.width, h = canvas.height;
  ctx.strokeStyle = lineColor; ctx.lineWidth = 2;
  for (const [a, b] of connections) {
    if (a >= landmarks.length || b >= landmarks.length) continue;
    const p1 = toPixel(landmarks[a], w, h), p2 = toPixel(landmarks[b], w, h);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
  ctx.fillStyle = pointColor;
  for (const lm of landmarks) {
    const p = toPixel(lm, w, h);
    ctx.beginPath(); ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPoints(landmarks, color, radius = 1) {
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = color;
  for (const lm of landmarks) {
    const p = toPixel(lm, w, h);
    ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
  }
}

function render(results) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.flags.face && results.face?.faceLandmarks) {
    for (const f of results.face.faceLandmarks) drawPoints(f, COLORS.facePoint, 1);
  }
  if (state.flags.hand && results.hand?.landmarks) {
    for (const hnd of results.hand.landmarks) drawConnected(hnd, HAND_CONNECTIONS, COLORS.handLine, COLORS.handPoint);
  }
  if (state.flags.pose && results.pose?.landmarks) {
    for (const p of results.pose.landmarks) drawConnected(p, POSE_CONNECTIONS, COLORS.poseLine, COLORS.posePoint);
  }
}

let _models = null; // set by startLoop via loadModels
let lastVideoTime = -1;
let fpsSamples = [];

async function startLoop() {
  _models = await loadModels();
  syncCanvas();
  state.running = true;
  setStatus("running");
  startBtn.textContent = "STOP CAMERA";
  startBtn.disabled = false;
  requestAnimationFrame(loop);
}

function loop() {
  if (!state.running) return;
  syncCanvas();
  if (video.currentTime !== lastVideoTime && video.videoWidth > 0) {
    lastVideoTime = video.currentTime;
    const ts = performance.now();
    const results = {
      pose: state.flags.pose ? _models.pose.detectForVideo(video, ts) : null,
      hand: state.flags.hand ? _models.hand.detectForVideo(video, ts) : null,
      face: state.flags.face ? _models.face.detectForVideo(video, ts) : null,
    };
    render(results);
    fpsSamples.push(ts);
    if (fpsSamples.length > 30) fpsSamples.shift();
    fpsEl.textContent = rollingFps(fpsSamples, ts) || "--";
    pointsEl.textContent = countPoints(results, state.flags);
  }
  requestAnimationFrame(loop);
}
```

> Rename the loader's internal `_models` variable to avoid the name clash: in
> Task 4's `loadModels`, keep its cache variable named `_modelsCache` instead of
> `_models`. Update both the `if (_modelsCache) return _modelsCache;` and the
> assignment. The renderer's module-level `_models` holds the active set.

- [ ] **Step 3: Wire a temporary start to verify end-to-end**

Temporarily append:
```js
startBtn.addEventListener("click", async () => { await startCamera(); await startLoop(); });
```
Run the server, open the page, click START.
Expected: live mirrored feed with the body skeleton (orange lines / magenta joints), hand skeletons, and a green face mesh, all aligned to your body. FPS readout updates (typically 15–60 depending on hardware). POINTS shows a non-zero count (~33 + hands + 478 when all visible).

- [ ] **Step 4: Remove the temporary listener.**

- [ ] **Step 5: Commit**

```bash
git add web/app.js
git commit -m "feat(web): inference loop + canvas renderer for pose/hand/face overlays"
```

---

### Task 6: HUD wiring — toggles, mirror, start/stop, repo link

**Files:**
- Modify: `web/app.js`
- Modify: `web/index.html` (set the real GitHub URL)

**Interfaces:**
- Consumes: everything above.
- Produces: final event wiring; no new exports. After this task the app is fully interactive from the UI alone.

- [ ] **Step 1: Append the wiring block at the end of `app.js`**

```js
// --- HUD wiring ---
el("tgPose").addEventListener("change", (e) => { state.flags.pose = e.target.checked; });
el("tgHand").addEventListener("change", (e) => { state.flags.hand = e.target.checked; });
el("tgFace").addEventListener("change", (e) => { state.flags.face = e.target.checked; });

function applyMirror() { stage.classList.toggle("is-mirrored", state.mirror); }
el("tgMirror").addEventListener("change", (e) => { state.mirror = e.target.checked; applyMirror(); });
applyMirror();

startBtn.addEventListener("click", async () => {
  if (state.running) { stopCamera(); ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
  try { await startCamera(); await startLoop(); } catch { /* error already shown */ }
});
```

- [ ] **Step 2: Set the GitHub link**

In `web/index.html`, change `#repoLink` `href="#"` to the repository URL.
Run: `git remote get-url origin`
Use that URL (convert `git@github.com:user/repo.git` → `https://github.com/user/repo`). If no remote is set yet, leave `href="#"` and a `TODO` is acceptable only here; it will be set in Task 9 after the remote exists.

- [ ] **Step 3: Full manual verification (real camera)**

Run the server, open the page. Verify each:
- START begins the feed and shows overlays; button now reads STOP CAMERA; status `● LIVE`.
- Toggling POSE / HANDS / FACE removes/restores each overlay layer immediately, and POINTS updates.
- Toggling MIRROR flips the feed AND the overlay together (a raised right hand stays aligned with its skeleton in both states).
- STOP ends the feed, clears the canvas, status `● IDLE`, button reads START CAMERA. START works again.

- [ ] **Step 4: Automated UI-state check with Playwright (fake camera)**

Run:
```bash
cd web
python3 -m http.server 8000 &
SRV=$!
npx --yes playwright@1.48 install chromium >/dev/null 2>&1
node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"] });
  const p = await b.newPage();
  await p.goto("http://localhost:8000/");
  await p.click("#startBtn");
  await p.waitForFunction(() => document.querySelector("#status").textContent.includes("LIVE"), { timeout: 20000 });
  await p.waitForFunction(() => document.querySelector("#modelStatus").textContent === "ready", { timeout: 20000 });
  console.log("STATUS OK:", await p.textContent("#status"));
  await p.click("#tgFace"); await p.click("#tgHand"); await p.click("#tgPose");
  await p.click("#startBtn"); // stop
  console.log("AFTER STOP:", await p.textContent("#status"));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
'
kill $SRV
```
Expected: prints `STATUS OK: ● LIVE` and `AFTER STOP: ● IDLE`, exit 0. (Fake device feeds a synthetic stream, so no real landmarks — this verifies wiring/state, not detection.)

- [ ] **Step 5: Commit**

```bash
git add web/app.js web/index.html
git commit -m "feat(web): wire toggles, mirror, start/stop controls"
```

---

### Task 7: Design iteration with the ralph loop, then pick the winner

This task explores executions **within** the fixed instrument lane and selects the strongest. The concept does not change; only grid density, accent color, readout/switch styling, framing ticks, and landmark stroke styling vary.

**Files:**
- Create (throwaway): `web/themes/theme-a.css` … `web/themes/theme-d.css`
- Modify: `web/style.css` (fold in the winner)
- Create (throwaway): `web/themes/preview.html` (loads the shell with a `?theme=` query)

**Interfaces:** none exported; CSS-only variation over the Task 1 markup.

- [ ] **Step 1: Invoke the ralph-loop skill to generate variants**

Use the `ralph-loop:ralph-loop` skill. Goal prompt for the loop:

> "Produce 4 distinct CSS theme files `web/themes/theme-{a,b,c,d}.css` that restyle the existing HOLISTIC.TRACK shell. Stay strictly in the technical/instrument lane: dark background, monospace, fine grid, HUD readouts, corner ticks. Each variant must differ meaningfully in: accent color (e.g. cyan, amber, lime, magenta-on-graphite), grid density/contrast, switch styling (toggle vs. bracketed labels), readout typography, and feed-frame treatment. Each theme only overrides CSS custom properties and component rules already present in `style.css` — it must not require markup changes. For each, also append a one-paragraph rationale to `web/themes/NOTES.md`. Stop after 4 viable variants exist and all load without console errors."

Consult `frontend-design:frontend-design` and `ui-ux-pro-max:ui-ux-pro-max` for craft (typographic scale, spacing rhythm, accessible contrast) while writing each variant.

- [ ] **Step 2: Create the preview harness**

```html
<!-- web/themes/preview.html -->
<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="../style.css">
<script>const t=new URLSearchParams(location.search).get("theme");
if(t){const l=document.createElement("link");l.rel="stylesheet";l.href=`theme-${t}.css`;document.head.appendChild(l);}</script>
</head><body>
<!-- paste the <header>, <main>, <footer> markup from index.html here for static preview -->
</body></html>
```
Copy the `<header>…</footer>` markup from `index.html` into the body so themes render without a live camera.

- [ ] **Step 3: Screenshot each variant**

Run (after starting `python3 -m http.server 8000` in `web/`):
```bash
node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  for (const t of ["a","b","c","d"]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto(`http://localhost:8000/themes/preview.html?theme=${t}`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `themes/shot-${t}.png` });
  }
  await b.close();
})();
'
```

- [ ] **Step 4: Evaluate and pick**

Read the four screenshots. Score each on: legibility of readouts on the dark feed, instrument-authenticity (does it read as a CV tool, not a template), accent restraint, switch/affordance clarity, and overall coherence. Present the four shots and the recommendation to the user via the design decision; let the user confirm the winner. (This is the "pick the best" gate the user asked for.)

- [ ] **Step 5: Fold the winner into `style.css`**

Merge the winning theme's overrides into `web/style.css` so the single stylesheet stands alone.

- [ ] **Step 6: Delete the throwaway artifacts**

```bash
git rm -r --cached web/themes 2>/dev/null; rm -rf web/themes
```
Confirm only `web/index.html`, `web/style.css`, `web/app.js`, `web/lib/*` remain under `web/` (plus `vercel.json` from Task 8).

- [ ] **Step 7: Manual verification**

Run the server, open `http://localhost:8000/`, START the camera. Confirm the chosen aesthetic is applied, overlays remain legible against it, and nothing regressed.

- [ ] **Step 8: Commit**

```bash
git add web/style.css
git commit -m "style(web): apply selected instrument theme from design iteration"
```

---

### Task 8: Vercel static config + production-readiness check

**Files:**
- Create: `web/vercel.json`
- Create: `.gitignore` (if not present) — ensure `.venv/`, `__pycache__/`, `.ipynb_checkpoints/` excluded

**Interfaces:** none.

- [ ] **Step 1: Write `web/vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
      ]
    }
  ]
}
```
> COOP/COEP are set because MediaPipe's WASM threading benefits from cross-origin
> isolation. `credentialless` keeps CDN model fetches working without CORP headers.

- [ ] **Step 2: Ensure a sane `.gitignore` at repo root**

If `.gitignore` is missing or lacks these, add:
```
.venv/
__pycache__/
.ipynb_checkpoints/
*.pyc
web/themes/
```

- [ ] **Step 3: Verify the COOP/COEP headers don't break CDN loading**

Re-run the Playwright fake-camera check from Task 6 Step 4 but serve with the headers (simulate by adding them in a tiny Node static server, or just re-verify on a Vercel preview in Task 9). Expected: models still reach `ready`, no COEP-blocked-resource errors in console. If the CDN model fetch is blocked by COEP, change `crossOrigin` handling: simplest fallback is to drop COEP to `unsafe-none` (single-threaded WASM still works). Document whichever is used.

- [ ] **Step 4: Commit**

```bash
git add web/vercel.json .gitignore
git commit -m "chore(web): add Vercel static config and gitignore"
```

---

### Task 9: Commit everything + push to GitHub + deploy to Vercel

**Files:** none new.

- [ ] **Step 1: Stage and commit any remaining project files the user wants tracked**

```bash
git status
```
Review untracked files (`body_tracking.py`, `models/`, the notebook). Confirm with the user which to commit. `models/*.task` are large (~17 MB total) — recommend adding `models/` to `.gitignore` rather than committing binaries, since `body_tracking.py` re-downloads them. Commit the source:
```bash
git add body_tracking.py "Media Pipe Holistic Tutorial.ipynb"
git commit -m "chore: track Python tracker source alongside web demo"
```

- [ ] **Step 2: Ensure a GitHub remote exists**

```bash
git remote -v
```
If no `origin`, create the repo (requires `gh`):
```bash
gh repo create Full-Body-Estimation-using-Media-Pipe-Holistic --public --source=. --remote=origin
```
Then set the `#repoLink` href in `index.html` if it was left as `#` (Task 6 Step 2), and commit that one-line change.

- [ ] **Step 3: Push**

```bash
git push -u origin main
```
Expected: branch `main` pushed; `git status` clean.

- [ ] **Step 4: Deploy to Vercel**

Set the project root to `web/` (where `vercel.json` and `index.html` live). Use the Vercel deploy flow (the `vercel:deploy` skill, or the Vercel MCP `deploy_to_vercel`, or `npx vercel --cwd web --prod`). Capture the production URL.

- [ ] **Step 5: Verify the live deployment**

Open the production URL in a browser. Verify: page loads over HTTPS, START requests the camera, all three overlays render and align, toggles + mirror work, FPS updates, footer privacy line and working GitHub link are present. Confirm no console errors (especially COOP/COEP or CDN 4xx).

- [ ] **Step 6: Report**

Report the GitHub repo URL and the Vercel production URL to the user.

---

## Self-Review

**Spec coverage:**
- Live in-browser demo, all three landmarkers → Tasks 3–5. ✓
- Single project / zero-build 3 files → Task 1 + Global Constraints (geometry lib added as a tested helper module; still zero-build, no bundler). ✓
- Per-layer toggles + mirror + FPS + points + start/stop → Tasks 5–6. ✓
- Instrument aesthetic → Task 1 baseline, Task 7 iteration/selection. ✓
- States (idle/requesting/denied/loading/running/stopped) → Tasks 3–5. ✓
- CDN models, same URLs, lite pose → Global Constraints + Task 4. ✓
- Privacy note + wordmark verbatim → Global Constraints + Task 1. ✓
- ralph-loop iteration then pick best → Task 7. ✓
- Commit to GitHub + deploy to Vercel → Tasks 8–9. ✓

**Placeholder scan:** One intentional, gated `href="#"` allowance in Task 6 Step 2, resolved in Task 9 Step 2. No other TBD/TODO. Verification steps all contain exact commands/expected output.

**Type consistency:** `results` shape `{ pose:{landmarks}, hand:{landmarks}, face:{faceLandmarks} }` is consistent across `countPoints` (Task 2), `render`/`loop` (Task 5). `state.flags` keys `{pose,hand,face}` consistent across Tasks 3/5/6. Loader cache renamed to `_modelsCache` (Task 5 note) to avoid clashing with the renderer's `_models`. `setStatus` names (`idle`/`loading`/`running`) consistent Tasks 3/5.

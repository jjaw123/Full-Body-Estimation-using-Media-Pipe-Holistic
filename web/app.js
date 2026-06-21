// HOLISTIC.TRACK — main module
import {
  FilesetResolver, PoseLandmarker, HandLandmarker, FaceLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";
import { POSE_CONNECTIONS, HAND_CONNECTIONS, toPixel, rollingFps, countPoints } from "./lib/geometry.mjs";

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

const MODEL_URLS = {
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
};

let _modelsCache = null;
async function loadModels() {
  if (_modelsCache) return _modelsCache;
  const modelStatus = el("modelStatus");
  modelStatus.textContent = "loading…";
  try {
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
    _modelsCache = { pose, hand, face };
    modelStatus.textContent = "ready";
    return _modelsCache;
  } catch (e) {
    // Surface model-load failure instead of hanging on "loading…".
    modelStatus.textContent = "failed";
    setStatus("idle");
    showError("Could not load the tracking models. Check your connection and try again.");
    startBtn.disabled = false;
    startBtn.textContent = "START CAMERA";
    throw e;
  }
}

function setStatus(name) {
  statusEl.dataset.state = name;
  statusEl.textContent = name === "running" ? "● LIVE" : name === "loading" ? "● LOADING" : "● IDLE";
}

function showError(msg) {
  errBox.hidden = false;
  // Write into the styled message slot if present; fall back to the box itself.
  const slot = errBox.querySelector(".err-msg") || errBox;
  slot.textContent = msg;
}
function clearError() {
  errBox.hidden = true;
  const slot = errBox.querySelector(".err-msg");
  if (slot) slot.textContent = ""; else errBox.textContent = "";
}

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
  stopRecording();
  if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
  video.srcObject = null;
  setStatus("idle");
  startBtn.textContent = "START CAMERA";
  startBtn.disabled = false;
  setCaptureEnabled(false);
}

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
  setCaptureEnabled(true);
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

// --- Capture helpers ---
const snapBtn = el("snapBtn");
const recBtn = el("recBtn");
let _recorder = null;
let _recChunks = [];

function compositeFrame(targetCtx, w, h) {
  if (state.mirror) { targetCtx.save(); targetCtx.translate(w, 0); targetCtx.scale(-1, 1); }
  targetCtx.drawImage(video, 0, 0, w, h);
  targetCtx.drawImage(canvas, 0, 0, w, h);
  if (state.mirror) targetCtx.restore();
}

function takeScreenshot() {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return;
  const off = Object.assign(document.createElement("canvas"), { width: w, height: h });
  compositeFrame(off.getContext("2d"), w, h);
  const a = document.createElement("a");
  a.download = `holistic-${Date.now()}.png`;
  a.href = off.toDataURL("image/png");
  a.click();
}

function startRecording() {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return;
  const recCanvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const rc = recCanvas.getContext("2d");
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
    .find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  _recChunks = [];
  _recorder = new MediaRecorder(recCanvas.captureStream(30), mimeType ? { mimeType } : {});
  _recorder.ondataavailable = (e) => { if (e.data.size) _recChunks.push(e.data); };
  _recorder.onstop = () => {
    const blob = new Blob(_recChunks, { type: _recorder.mimeType || "video/webm" });
    const a = document.createElement("a");
    a.download = `holistic-${Date.now()}.webm`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
    _recChunks = [];
  };
  _recorder.start(200);
  recBtn.classList.add("is-recording");
  recBtn.textContent = "";
  const dot = Object.assign(document.createElement("span"), { className: "rec-dot", "aria-hidden": "true" });
  recBtn.append(dot, " STOP");
  (function drawLoop() {
    if (!_recorder || _recorder.state === "inactive") return;
    compositeFrame(rc, w, h);
    requestAnimationFrame(drawLoop);
  })();
}

function stopRecording() {
  if (_recorder && _recorder.state !== "inactive") _recorder.stop();
  _recorder = null;
  recBtn.classList.remove("is-recording");
  recBtn.textContent = "";
  const resetDot = Object.assign(document.createElement("span"), { className: "rec-dot" });
  resetDot.setAttribute("aria-hidden", "true");
  recBtn.append(resetDot, " REC");
}

function setCaptureEnabled(enabled) {
  snapBtn.disabled = !enabled;
  recBtn.disabled = !enabled;
}

snapBtn.addEventListener("click", takeScreenshot);
recBtn.addEventListener("click", () => {
  if (_recorder && _recorder.state !== "inactive") stopRecording();
  else startRecording();
});

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

export { state, video, stage, startBtn, setStatus, showError, clearError, startCamera, stopCamera, el, loadModels, startLoop };

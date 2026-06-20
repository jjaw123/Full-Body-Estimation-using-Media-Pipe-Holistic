// HOLISTIC.TRACK — main module
import {
  FilesetResolver, PoseLandmarker, HandLandmarker, FaceLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";

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
export { state, video, stage, startBtn, setStatus, showError, clearError, startCamera, stopCamera, el, loadModels };

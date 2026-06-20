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

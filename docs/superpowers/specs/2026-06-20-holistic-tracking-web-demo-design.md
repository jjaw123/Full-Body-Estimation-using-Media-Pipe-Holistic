# Holistic Tracking — Live In-Browser Demo (Design)

**Date:** 2026-06-20
**Status:** Approved (pending spec review)

## Summary

A static, single-page website that runs MediaPipe full-body tracking (pose,
hands, face) live on the visitor's webcam — the browser twin of the existing
`body_tracking.py` script. No backend, no upload, no install. Everything runs
client-side via the MediaPipe Tasks Vision WASM build loaded from CDN.

Aesthetic: **technical / instrument** — dark, precise, monospace accents, fine
grid, HUD-style readouts. The skeleton and landmarks read like a computer-vision
instrument, not a marketing page.

## Goals

- Mirror the Python script's behavior in the browser: pose + hand + face
  landmarks overlaid on a live, mirrored webcam feed.
- Give the user per-layer control: toggle pose / hands / face independently.
- Show live instrumentation: FPS, detected landmark count, status.
- Zero build step. Host-anywhere static files. Deployable to Vercel and
  openable directly from disk.

## Non-Goals

- No recording, export, or screenshot (can be added later; out of scope now).
- No server, no data persistence, no analytics.
- No marketing/landing sections — this is a focused instrument, not a brochure.
- No mobile-first optimization beyond graceful responsive behavior (desktop
  webcam is the primary target).

## Tech Stack

- Plain HTML / CSS / JS, **3-file zero-build split**: `index.html`,
  `style.css`, `app.js`. Chosen over a single file for readability while
  keeping zero build tooling.
- MediaPipe `@mediapipe/tasks-vision` loaded from CDN (ESM import in `app.js`).
- Models loaded from Google's hosted `.task` URLs — the same URLs the Python
  script uses:
  - pose: `pose_landmarker_lite` (float16, latest)
  - hand: `hand_landmarker` (float16, latest)
  - face: `face_landmarker` (float16, latest)
  - WASM fileset: MediaPipe CDN `wasm` path.

## Architecture

Four clear units, each independently understandable:

### 1. Camera module
- `navigator.mediaDevices.getUserMedia({ video: true })` → bound to a `<video>`.
- Owns start/stop lifecycle. Surfaces explicit states: idle, requesting,
  denied, no-camera, running, stopped.
- Honors the **mirror** toggle (CSS/transform on the video + matching flip in
  the renderer so overlays line up). Default mirrored, matching `cv2.flip`.

### 2. Model loader
- Creates the three `*Landmarker` instances in `RunningMode.VIDEO`
  (`PoseLandmarker`, `HandLandmarker`, `FaceLandmarker`) via
  `FilesetResolver`.
- num_poses=1, num_hands=2, num_faces=1 (matches Python).
- Emits a loading state while WASM + model files download (can take a few
  seconds on first load) — UI shows a determinate-feeling loading line.

### 3. Inference loop
- `requestAnimationFrame` loop. Each frame: feed the current video frame to the
  enabled landmarkers via `detectForVideo(frame, timestampMs)` with a
  monotonically rising timestamp (mirrors the Python `timestamp_ms`).
- Skips disabled layers (toggles) to save compute.
- Computes rolling FPS and total detected landmark count.

### 4. Renderer
- A `<canvas>` layered exactly over the `<video>`, sized to the video's
  intrinsic resolution.
- Draws connections then points per layer, reusing the Python topology:
  - `POSE_CONNECTIONS` (35 edges, the exact list from `body_tracking.py`).
  - `HAND_CONNECTIONS` (21 edges).
  - Face drawn as points (dense mesh), matching the Python `draw_points`.
- Per-layer colors in the instrument palette (distinct, legible on dark feed).

### HUD / Controls (DOM, no framework)
- Header bar: `HOLISTIC.TRACK` wordmark + status indicator (`● LIVE` / `IDLE`).
- Feed pane: video + canvas, framed with corner ticks and a faint grid overlay.
- Side rail of readouts: FPS, points detected, model status.
- Instrument-style switches: pose / hands / face / mirror.
- Primary control: Start / Stop camera.
- Footer: one-line "runs entirely in your browser — no video leaves your
  device" privacy note + GitHub link.

## States

| State | UI |
| --- | --- |
| idle | "Start camera" prompt, feed pane empty with grid |
| requesting | spinner / "requesting camera…" |
| denied / no-camera | clear error message + retry affordance |
| loading models | determinate-feeling loading line, controls disabled |
| running | live overlay, readouts updating, Stop available |
| stopped | last frame frozen or cleared, Start available again |

## Design Iteration Plan (ralph loop)

The visual concept (technical/instrument) is **fixed**. The ralph loop is used
only to generate a few distinct *executions* within that lane — varying grid
density, accent color, readout layout, and landmark rendering style — render
them, and pick the strongest. `frontend-design` and `ui-ux-pro-max` inform the
craft within the chosen lane. The loop does not re-decide the concept.

## Delivery

When the demo is complete and verified working in a browser:
1. Commit all changes to git and push to GitHub (`main`).
2. Deploy the static site to Vercel.

A minimal `vercel.json` (or Vercel's zero-config static detection) serves the
three files at the repo root or from a `web/` directory — directory location to
be decided in the implementation plan.

## Open Questions (resolved)

- Single-file vs split → **3-file split**.
- Mirror toggle → **included**, default on.
- Screenshot/record → **out of scope** for now.

## Testing / Verification

- Manual browser verification: camera starts, all three layers render and align,
  toggles enable/disable each layer, FPS readout updates, mirror toggle flips
  feed and overlays together, error states show when camera is denied.
- Verify it loads as static files (Vercel preview) and the CDN model/WASM URLs
  resolve.

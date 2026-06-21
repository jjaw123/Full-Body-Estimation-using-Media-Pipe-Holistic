# HOLISTIC.TRACK

Real-time full-body motion capture — pose, hands, and face — running entirely in your browser. No server. No uploads. No installs.

**[Live Demo →](https://web-omega-ten-38.vercel.app)**

---

## What it tracks

| Layer | Detail |
|-------|--------|
| Pose | 33 body landmarks (shoulders, elbows, wrists, hips, knees, ankles, …) |
| Hands | 21 nodes × 2 hands |
| Face | 478 keypoints |

All three run simultaneously, GPU-accelerated, at real-time frame rates.

---

## Features

- **Zero server** — MediaPipe Tasks Vision runs as WASM + WebGL in the tab; video never leaves your device
- **Layer toggles** — turn pose / hands / face overlays on or off independently
- **Mirror mode** — flip the feed axis for selfie-style display
- **Screenshot** — download the current annotated frame as a PNG
- **Record** — capture a WebM video of the annotated feed; click again to stop and download
- **Python tracker** — `body_tracking.py` for local webcam use via OpenCV + MediaPipe

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Inference | [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) 0.10.18 |
| Runtime | Plain ES modules — no bundler, no framework |
| Hosting | [Vercel](https://vercel.com) |
| Python | OpenCV + MediaPipe Holistic |

---

## Run locally

### Web demo

Any static file server works:

```bash
cd web
npx serve .
# → http://localhost:3000
```

Or open `web/index.html` directly — models load from Google's CDN.

### Python tracker

Requires Python 3.8+ and a webcam:

```bash
pip install mediapipe opencv-python
python body_tracking.py
```

Press `q` to quit.

---

## Project structure

```
├── web/
│   ├── index.html       # UI shell
│   ├── app.js           # Camera, model loading, inference loop
│   ├── style.css        # Instrument-console design system
│   ├── lib/
│   │   └── geometry.mjs # Landmark connections, coordinate utils
│   └── vercel.json      # Hosting config + security headers
├── body_tracking.py     # Python / OpenCV tracker
├── models/              # Model files for Python path
└── Media Pipe Holistic Tutorial.ipynb
```

---

## Privacy

Video is processed on-device. Nothing is transmitted — the app works fully offline once the models are cached by the browser.

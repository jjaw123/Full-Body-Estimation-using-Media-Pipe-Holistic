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

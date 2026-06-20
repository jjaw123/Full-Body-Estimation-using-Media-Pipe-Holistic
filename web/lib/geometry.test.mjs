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

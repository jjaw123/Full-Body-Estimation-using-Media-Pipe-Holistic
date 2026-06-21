import os
import time
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


MODEL_DIR = "models"

MODELS = {
    "pose": (
        "models/pose_landmarker_lite.task",
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
    ),
    "hand": (
        "models/hand_landmarker.task",
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
    ),
    "face": (
        "models/face_landmarker.task",
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    ),
}


POSE_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 7), (0, 4), (4, 5), (5, 6), (6, 8),
    (9, 10), (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21),
    (17, 19), (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    (11, 23), (12, 24), (23, 24), (23, 25), (24, 26), (25, 27), (26, 28),
    (27, 29), (28, 30), (29, 31), (30, 32), (27, 31), (28, 32),
]

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]


def download_models():
    os.makedirs(MODEL_DIR, exist_ok=True)

    for name, (path, url) in MODELS.items():
        if not os.path.exists(path):
            print(f"Downloading {name} model...")
            urllib.request.urlretrieve(url, path)


def to_pixel(landmark, width, height):
    return int(landmark.x * width), int(landmark.y * height)


def draw_points(image, landmarks, color, radius=1):
    height, width, _ = image.shape

    for landmark in landmarks:
        x, y = to_pixel(landmark, width, height)
        cv2.circle(image, (x, y), radius, color, -1)


def draw_connected_landmarks(image, landmarks, connections, point_color, line_color):
    height, width, _ = image.shape

    for start, end in connections:
        if start >= len(landmarks) or end >= len(landmarks):
            continue

        x1, y1 = to_pixel(landmarks[start], width, height)
        x2, y2 = to_pixel(landmarks[end], width, height)
        cv2.line(image, (x1, y1), (x2, y2), line_color, 2)

    for landmark in landmarks:
        x, y = to_pixel(landmark, width, height)
        cv2.circle(image, (x, y), 4, point_color, -1)


def main():
    download_models()

    base_options_pose = python.BaseOptions(model_asset_path=MODELS["pose"][0])
    base_options_hand = python.BaseOptions(model_asset_path=MODELS["hand"][0])
    base_options_face = python.BaseOptions(model_asset_path=MODELS["face"][0])

    pose_options = vision.PoseLandmarkerOptions(
        base_options=base_options_pose,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
    )

    hand_options = vision.HandLandmarkerOptions(
        base_options=base_options_hand,
        running_mode=vision.RunningMode.VIDEO,
        num_hands=2,
    )

    face_options = vision.FaceLandmarkerOptions(
        base_options=base_options_face,
        running_mode=vision.RunningMode.VIDEO,
        num_faces=1,
    )

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Could not open webcam. Check camera permissions.")
        return

    with (
        vision.PoseLandmarker.create_from_options(pose_options) as pose_landmarker,
        vision.HandLandmarker.create_from_options(hand_options) as hand_landmarker,
        vision.FaceLandmarker.create_from_options(face_options) as face_landmarker,
    ):
        start_time = time.time()

        while True:
            ret, frame = cap.read()

            if not ret:
                print("Could not read from webcam.")
                break

            frame = cv2.flip(frame, 1)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

            timestamp_ms = int((time.time() - start_time) * 1000)

            pose_result = pose_landmarker.detect_for_video(mp_image, timestamp_ms)
            hand_result = hand_landmarker.detect_for_video(mp_image, timestamp_ms)
            face_result = face_landmarker.detect_for_video(mp_image, timestamp_ms)

            if face_result.face_landmarks:
                for face_landmarks in face_result.face_landmarks:
                    draw_points(frame, face_landmarks, (80, 220, 120), radius=1)

            if hand_result.hand_landmarks:
                for hand_landmarks in hand_result.hand_landmarks:
                    draw_connected_landmarks(
                        frame,
                        hand_landmarks,
                        HAND_CONNECTIONS,
                        point_color=(121, 44, 250),
                        line_color=(121, 22, 76),
                    )

            if pose_result.pose_landmarks:
                for pose_landmarks in pose_result.pose_landmarks:
                    draw_connected_landmarks(
                        frame,
                        pose_landmarks,
                        POSE_CONNECTIONS,
                        point_color=(245, 66, 230),
                        line_color=(245, 117, 66),
                    )

            cv2.imshow("Full Body Tracking - Press q to quit", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

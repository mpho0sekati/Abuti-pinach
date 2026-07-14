/**
 * Face tracking utilities powered by MediaPipe FaceLandmarker.
 * Loaded lazily from CDN so it doesn't inflate the app bundle.
 *
 * Emits two window events consumed elsewhere in the app:
 *   - "orb:gaze"        { x, y }                — viewport coords for the closest face
 *   - "orb:face-update" { expression, faceCount, distance, changed }
 */

export type FaceExpression =
  | "neutral"
  | "happy"
  | "surprised"
  | "sad"
  | "angry"
  | "sleepy";

export interface FaceUpdate {
  expression: FaceExpression;
  faceCount: number;
  /** 0..1 — larger = closer to camera */
  distance: number;
  /** true if the expression changed vs previous frame */
  changed: boolean;
}

const CDN_MODULE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/vision_bundle.mjs";
const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<any> | null = null;

async function loadLandmarker(): Promise<any> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    // @vite-ignore keeps Vite from trying to bundle the CDN URL
    const vision: any = await import(/* @vite-ignore */ CDN_MODULE);
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
    // Try GPU first, fall back to CPU (many desktop browsers lack the WebGL delegate)
    let landmarker: any;
    try {
      landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 3,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    } catch (gpuErr) {
      console.warn("[faceTracking] GPU delegate failed, falling back to CPU", gpuErr);
      landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numFaces: 3,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    }
    return landmarker;
  })();
  return landmarkerPromise;
}

function classifyExpression(blendshapes: any[]): FaceExpression {
  if (!blendshapes || blendshapes.length === 0) return "neutral";
  const map: Record<string, number> = {};
  for (const s of blendshapes) map[s.categoryName] = s.score;

  const smile = Math.max(map.mouthSmileLeft || 0, map.mouthSmileRight || 0);
  const frown = Math.max(map.mouthFrownLeft || 0, map.mouthFrownRight || 0);
  const jawOpen = map.jawOpen || 0;
  const browUp = Math.max(
    map.browInnerUp || 0,
    map.browOuterUpLeft || 0,
    map.browOuterUpRight || 0
  );
  const browDown = Math.max(
    map.browDownLeft || 0,
    map.browDownRight || 0
  );
  const eyeClosed = Math.max(
    map.eyeBlinkLeft || 0,
    map.eyeBlinkRight || 0
  );

  if (jawOpen > 0.4 && browUp > 0.3) return "surprised";
  if (smile > 0.35) return "happy";
  if (frown > 0.25 || (browDown > 0.4 && smile < 0.1)) {
    return browDown > 0.4 && frown < 0.2 ? "angry" : "sad";
  }
  if (eyeClosed > 0.75) return "sleepy";
  return "neutral";
}

interface TrackerHandle {
  stop: () => void;
}

function createMotionTracker(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  const width = 96;
  const height = 72;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let previous: Uint8ClampedArray | null = null;
  let lastSample = 0;
  let lastMotion = 0;
  let lastX = 0.5;
  let lastY = 0.42;

  return {
    detect() {
      if (!ctx || video.readyState < 2 || video.videoWidth === 0) return null;
      const now = performance.now();
      if (now - lastSample < 70) {
        return now - lastMotion < 1600
          ? { x: (1 - lastX) * window.innerWidth, y: lastY * window.innerHeight, distance: 0.55 }
          : null;
      }
      lastSample = now;

      try {
        ctx.drawImage(video, 0, 0, width, height);
      } catch {
        return null;
      }

      const rgba = ctx.getImageData(0, 0, width, height).data;
      const gray = new Uint8ClampedArray(width * height);
      let weight = 0;
      let sx = 0;
      let sy = 0;

      for (let p = 0; p < gray.length; p++) {
        const i = p * 4;
        const g = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
        gray[p] = g;
        if (!previous) continue;
        const diff = Math.abs(g - previous[p]);
        if (diff > 18) {
          const x = p % width;
          const y = Math.floor(p / width);
          weight += diff;
          sx += x * diff;
          sy += y * diff;
        }
      }
      previous = gray;

      if (weight > 5200) {
        const nx = sx / weight / width;
        const ny = sy / weight / height;
        lastX = lastX * 0.65 + nx * 0.35;
        lastY = lastY * 0.65 + ny * 0.35;
        lastMotion = now;
      }

      if (now - lastMotion < 1600) {
        return {
          // The selfie preview is mirrored in CSS, so flip raw camera x to match what the user sees.
          x: (1 - lastX) * window.innerWidth,
          y: lastY * window.innerHeight,
          distance: Math.min(1, Math.max(0.2, weight / 70000)),
        };
      }
      return null;
    },
  };
}

/**
 * Start tracking faces on a live <video> element.
 * Dispatches window events; caller passes onError for graceful degradation.
 */
export async function startFaceTracking(
  video: HTMLVideoElement,
  onError?: (e: unknown) => void
): Promise<TrackerHandle> {
  let stopped = false;
  let rafId = 0;
  let landmarker: any = null;
  let lastExpression: FaceExpression = "neutral";
  let lastEmit = 0;
  const motionTracker = createMotionTracker(video);

  loadLandmarker()
    .then((loaded) => {
      landmarker = loaded;
    })
    .catch((e) => {
      // Keep the lightweight motion tracker alive even if MediaPipe cannot load.
      onError?.(e);
    });

  const emitMotionFallback = (now: number) => {
    const motion = motionTracker.detect();
    if (!motion) return false;

    window.dispatchEvent(
      new CustomEvent<{ x: number; y: number }>("orb:gaze", {
        detail: { x: motion.x, y: motion.y },
      })
    );

    if (now - lastEmit > 320) {
      window.dispatchEvent(
        new CustomEvent<FaceUpdate>("orb:face-update", {
          detail: {
            expression: "neutral",
            faceCount: 1,
            distance: motion.distance,
            changed: false,
          },
        })
      );
      lastEmit = now;
    }
    return true;
  };

  const tick = () => {
    if (stopped) return;
    if (video.readyState < 2 || video.videoWidth === 0) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    const now = performance.now();
    if (!landmarker) {
      emitMotionFallback(now);
      rafId = requestAnimationFrame(tick);
      return;
    }
    let result: any;
    try {
      result = landmarker.detectForVideo(video, performance.now());
    } catch {
      emitMotionFallback(now);
      rafId = requestAnimationFrame(tick);
      return;
    }

    const faces = result?.faceLandmarks || [];

    if (faces.length === 0) {
      if (emitMotionFallback(now)) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      // periodic empty ping so UI can react
      if (now - lastEmit > 800) {
        window.dispatchEvent(
          new CustomEvent<FaceUpdate>("orb:face-update", {
            detail: {
              expression: "neutral",
              faceCount: 0,
              distance: 0,
              changed: false,
            },
          })
        );
        lastEmit = now;
      }
      rafId = requestAnimationFrame(tick);
      return;
    }

    // Pick the closest face = largest bbox area (from landmark spread)
    let bestIdx = 0;
    let bestArea = 0;
    for (let i = 0; i < faces.length; i++) {
      const pts = faces[i];
      let minX = 1,
        maxX = 0,
        minY = 1,
        maxY = 0;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const area = (maxX - minX) * (maxY - minY);
      if (area > bestArea) {
        bestArea = area;
        bestIdx = i;
      }
    }

    const pts = faces[bestIdx];
    let sx = 0,
      sy = 0;
    // Use the nose tip (landmark 1) — stable center of face
    const nose = pts[1] || pts[0];
    sx = nose.x;
    sy = nose.y;

    // Camera is mirrored via CSS scaleX(-1), so flip x back for gaze mapping
    const gazeNormX = 1 - sx;
    const gazeNormY = sy;

    // Map to viewport coordinates so the orb's global mouse-tracking picks it up
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clientX = gazeNormX * vw;
    const clientY = gazeNormY * vh;

    window.dispatchEvent(
      new CustomEvent<{ x: number; y: number }>("orb:gaze", {
        detail: { x: clientX, y: clientY },
      })
    );

    // Expression
    const shapes = result.faceBlendshapes?.[bestIdx]?.categories || [];
    const expression = classifyExpression(shapes);
    const changed = expression !== lastExpression;
    lastExpression = expression;

    window.dispatchEvent(
      new CustomEvent<FaceUpdate>("orb:face-update", {
        detail: {
          expression,
          faceCount: faces.length,
          distance: Math.min(1, bestArea * 3), // rough closeness metric
          changed,
        },
      })
    );
    lastEmit = now;

    rafId = requestAnimationFrame(tick);
  };

  tick();

  return {
    stop: () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}

"use client";

// Hides the harmless "XNNPACK delegate" info line Chrome shows as an "issue"
if (typeof window !== "undefined" && !(window as unknown as { __xnn?: boolean }).__xnn) {
  (window as unknown as { __xnn?: boolean }).__xnn = true;
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("XNNPACK")) return;
    originalError(...args);
  };
}

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { ARScene, TUNE } from "@/lib/arScene";
import { FACE_POSITIONS } from "@/lib/faceMesh";
import type { Glasses } from "@/lib/glasses";
import AIStylistOverlay from "@/components/AIStylistOverlay";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// =============================== face shape + skin tone ===============================
const AVG = { length: 1.153, forehead: 0.819, jaw: 0.775 }; 
type Shape = "Oval" | "Round" | "Square" | "Heart" | "Oblong" | "Diamond";
type Ratios = { length: number; forehead: number; jaw: number };

const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const dist = (p: NormalizedLandmark, q: NormalizedLandmark, W: number, H: number) =>
  Math.hypot((p.x - q.x) * W, (p.y - q.y) * H);

function measure(lm: NormalizedLandmark[], W: number, H: number) {
  const cheek = dist(lm[234], lm[454], W, H);
  const len = dist(lm[10], lm[152], W, H);
  return {
    length: len / cheek / AVG.length,
    forehead: dist(lm[54], lm[284], W, H) / cheek / AVG.forehead,
    jaw: dist(lm[172], lm[397], W, H) / cheek / AVG.jaw,
    mouthOpen: dist(lm[13], lm[14], W, H) / len,
  };
}

function classify({ length: L, forehead: F, jaw: J }: Ratios): Shape {
  if (L >= 1.1) return "Oblong";
  if (L <= 0.95) return J >= 1.04 ? "Square" : "Round";
  if (F < 0.94 && J < 0.94) return "Diamond";
  if (F - J >= 0.1 && F >= 0.96) return "Heart";
  if (J >= 1.05 && F >= 0.96) return "Square";
  return "Oval";
}

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function toLab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

function skinLabel(rgb: [number, number, number][]) {
  const labs = rgb.map(([r, g, b]) => toLab(r, g, b));
  const L = med(labs.map((x) => x[0]));
  const hue = (Math.atan2(med(labs.map((x) => x[2])), med(labs.map((x) => x[1]))) * 180) / Math.PI;
  const depth = L >= 70 ? "Fair" : L >= 60 ? "Light" : L >= 50 ? "Medium" : L >= 40 ? "Tan" : "Deep";
  const under = hue >= 58 ? "warm" : hue <= 49 ? "cool" : "neutral";
  return `${depth}, ${under} undertone`;
}

function skinPatches(video: HTMLVideoElement, lm: NormalizedLandmark[], c: HTMLCanvasElement) {
  const W = video.videoWidth, H = video.videoHeight;
  const side = Math.max(6, dist(lm[234], lm[454], W, H) * 0.07);
  c.width = 8;
  c.height = 8;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const out: [number, number, number][] = [];
  if (!ctx) return out;
  for (const i of [50, 280, 205, 425, 151]) {
    const sx = Math.min(Math.max(0, lm[i].x * W - side / 2), W - side);
    const sy = Math.min(Math.max(0, lm[i].y * H - side / 2), H - side);
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    const r: number[] = [], g: number[] = [], b: number[] = [];
    for (let p = 0; p < d.length; p += 4) {
      r.push(d[p]); g.push(d[p + 1]); b.push(d[p + 2]);
    }
    out.push([med(r), med(g), med(b)]);
  }
  return out;
}

type FitKey = "width" | "y" | "z" | "pitch" | "lensOpacity";
const FIT_DEFAULTS: Record<FitKey, number> = {
  width: TUNE.width, y: TUNE.y, z: TUNE.z, pitch: TUNE.pitch, lensOpacity: TUNE.lensOpacity,
};
const FIT_SLIDERS: { key: FitKey; label: string; min: number; max: number; step: number }[] = [
  { key: "width", label: "Size", min: 11, max: 17, step: 0.1 },
  { key: "y", label: "Up / down", min: 0, max: 5, step: 0.05 },
  { key: "z", label: "Closer / further", min: 2, max: 8, step: 0.05 },
  { key: "pitch", label: "Tilt", min: -0.3, max: 0.3, step: 0.01 },
  { key: "lensOpacity", label: "Lens tint", min: 0, max: 0.8, step: 0.01 },
];

interface TryOnViewProps {
  product: Glasses;
  color: string | null;
  productKey: string;
  currentColorName: string;
  onSelectFrame: (key: string) => void;
  onSelectColor: (colorName: string) => void;
  theme?: "dark" | "light";
  onFaceScanned?: (metrics: { shape: string; skinTone: string } | null) => void;
}

export default function TryOnView({
  product,
  color,
  productKey,
  currentColorName,
  onSelectFrame,
  onSelectColor,
  onFaceScanned,
}: TryOnViewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ARScene | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const roRef = useRef<ResizeObserver | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [message, setMessage] = useState("");
  const [aspect, setAspect] = useState(4 / 3);
  const [faceMetrics, setFaceMetrics] = useState<{ shape: string; skinTone: string } | null>(null);
  const [scan, setScan] = useState(0);
  const [dbg, setDbg] = useState("");
  const [fitOpen, setFitOpen] = useState(false);
  const [fit, setFit] = useState<Record<FitKey, number>>(FIT_DEFAULTS);

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("lumiere-fit-v2");
      if (s) {
        const o = JSON.parse(s) as Partial<Record<FitKey, number>>;
        Object.assign(TUNE, o);
        setFit((f) => ({ ...f, ...o }));
      }
    } catch {}
  }, []);

  function setFitValue(k: FitKey, v: number) {
    (TUNE as unknown as Record<string, number>)[k] = v;
    setFit((f) => {
      const n = { ...f, [k]: v };
      try {
        window.localStorage.setItem("lumiere-fit-v2", JSON.stringify(n));
      } catch {}
      return n;
    });
  }

  useEffect(() => {
    sceneRef.current?.setProduct(product, color, currentColorName);
  }, [productKey, status]);
  useEffect(() => {
    sceneRef.current?.setColor(color, currentColorName);
  }, [color, currentColorName]);

  useEffect(() => {
    return () => {
      stopRef.current = true;
      roRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  async function start() {
    setStatus("loading");
    setMessage("");
    stopRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const vw = video.videoWidth, vh = video.videoHeight;
      setAspect(vw / vh);

      if (hudCanvasRef.current) {
        hudCanvasRef.current.width = vw;
        hudCanvasRef.current.height = vh;
      }

      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const make = (delegate: "GPU" | "CPU") =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
        });
      try {
        landmarkerRef.current = await make("GPU");
      } catch {
        landmarkerRef.current = await make("CPU");
      }

      const scene = new ARScene(canvasRef.current!);
      sceneRef.current = scene;
      const fit = () => {
        const b = boxRef.current!;
        scene.resize(b.clientWidth, b.clientHeight);
      };
      await new Promise((r) => requestAnimationFrame(r));
      fit();
      roRef.current = new ResizeObserver(fit);
      roRef.current.observe(boxRef.current!);

      setStatus("running");
      runLoop(video, landmarkerRef.current, scene);
    } catch (e) {
      setStatus("error");
      setMessage("Couldn't start the camera or face tracking.");
      console.error(e);
    }
  }

  // Draw high-density geometric face wireframe matching the mirrored video alignment perfectly
  const drawFaceMeshHUD = (lm: NormalizedLandmark[], time: number) => {
    const canvas = hudCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lm || lm.length === 0) return;

    const W = canvas.width;
    const H = canvas.height;

    const pulse = 0.7 + Math.sin(time * 0.006) * 0.25;
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.lineWidth = 1.25;

    const meshLinks = [
      [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397], [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152],
      [10, 109], [109, 67], [67, 103], [103, 54], [54, 21], [21, 162], [162, 127], [127, 234], [234, 93], [93, 132], [132, 58], [58, 172], [172, 136], [136, 150], [150, 149], [149, 176], [176, 148], [148, 152],
      [1, 4], [4, 5], [5, 195], [195, 197], [197, 6], [6, 168], [168, 8], [8, 9], [9, 10], [152, 148],
      [33, 246], [246, 161], [161, 160], [160, 159], [159, 158], [158, 133], [133, 173], [173, 157], [157, 158], [133, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154], [154, 155], [155, 133], [33, 7],
      [70, 63], [63, 105], [105, 66], [66, 107], [107, 55], [55, 65], [52, 53], [46, 53], [70, 55],
      [263, 466], [466, 388], [388, 387], [387, 386], [386, 385], [385, 362], [362, 398], [398, 384], [384, 385], [362, 249], [249, 390], [390, 373], [373, 374], [374, 380], [380, 381], [381, 382], [382, 362], [263, 249],
      [300, 293], [293, 334], [334, 296], [296, 336], [336, 285], [285, 295], [282, 283], [276, 283], [300, 285],
      [168, 6], [6, 197], [197, 195], [195, 5], [5, 4], [4, 1], [1, 2], [2, 98], [98, 327], [2, 326], [326, 327], [2, 94], [94, 371], [371, 327], [94, 141], [141, 98],
      [61, 185], [185, 40], [40, 39], [39, 37], [37, 0], [0, 267], [267, 269], [269, 270], [270, 409], [409, 291],
      [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314], [314, 405], [405, 321], [321, 375], [375, 291],
      [78, 95], [95, 88], [88, 178], [178, 87], [87, 14], [14, 317], [317, 402], [402, 318], [318, 324], [324, 308], [308, 415], [415, 310], [310, 311], [311, 312], [312, 13], [13, 82], [82, 81], [81, 42], [42, 183], [183, 78],
      [234, 127], [127, 162], [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [454, 356], [356, 389], [389, 251], [251, 284], [284, 332], [332, 297], [297, 338],
      [234, 93], [93, 58], [58, 132], [132, 150], [454, 323], [323, 288], [288, 361], [361, 379]
    ];

    meshLinks.forEach(([i, j]) => {
      const p1 = lm[i];
      const p2 = lm[j];
      if (p1 && p2) {
        // Direct un-flipped screen mapping to align accurately over the video feed
        const x1 = p1.x * W;
        const y1 = p1.y * H;
        const x2 = p2.x * W;
        const y2 = p2.y * H;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    });

    const nodes = [10, 152, 234, 454, 1, 4, 33, 263, 61, 291, 199, 168, 109, 338, 58, 288, 6, 168, 0, 17];
    nodes.forEach((idx) => {
      const pt = lm[idx];
      if (pt) {
        ctx.beginPath();
        ctx.arc(pt.x * W, pt.y * H, 2.2, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  function runLoop(video: HTMLVideoElement, landmarker: FaceLandmarker, scene: ARScene) {
    const m = new THREE.Matrix4();
    const scratch = document.createElement("canvas");
    const samples: Ratios[] = [];
    const skin: [number, number, number][] = [];
    let scanned = false;
    let frame = 0;
    let luma = 0.5;
    let lastTime = -1;

    const onFrame = (time: number) => {
      if (stopRef.current) return;
      schedule();
      if (video.readyState < 2 || video.currentTime === lastTime) return;
      lastTime = video.currentTime;
      const now = performance.now();

      const res = landmarker.detectForVideo(video, now);
      const lm = res.faceLandmarks?.[0];
      const mat = res.facialTransformationMatrixes?.[0];

      if (!lm || !mat) {
        scene.setPose(null, now / 1000);
        scene.render();
        return;
      }

      m.fromArray(mat.data as unknown as number[]);
      if (Math.abs(mat.data[3]) + Math.abs(mat.data[7]) + Math.abs(mat.data[11]) > 0.01) m.transpose();
      scene.setPose(m, now / 1000);
      scene.render();
      frame++;

      if (!scanned) {
        drawFaceMeshHUD(lm, time);
      } else {
        const canvas = hudCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      if (frame % 12 === 0) {
        const p = skinPatches(video, lm, scratch);
        if (p.length) {
          const r = p.reduce((a, x) => a + x[0], 0) / p.length;
          const g = p.reduce((a, x) => a + x[1], 0) / p.length;
          const b = p.reduce((a, x) => a + x[2], 0) / p.length;
          luma += 0.3 * ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 - luma);
          scene.setLight(luma, [r, g, b]);
        }
      }

      const e = m.elements;
      const n = Math.hypot(e[8], e[9], e[10]) || 1;
      const yaw = (Math.atan2(e[8] / n, e[10] / n) * 180) / Math.PI;
      const pitch = (Math.asin(e[9] / n) * 180) / Math.PI;
      const q = measure(lm, video.videoWidth, video.videoHeight);

      if (scanned || Math.abs(yaw) > 12 || Math.abs(pitch) > 14 || q.mouthOpen > 0.045) return;
      samples.push({ length: q.length, forehead: q.forehead, jaw: q.jaw });
      if (samples.length % 3 === 0) skin.push(...skinPatches(video, lm, scratch));
      
      const progress = Math.min(1, samples.length / 25);
      setScan(progress);

      if (samples.length >= 25 && skin.length >= 8) {
        scanned = true;
        const metrics = {
          shape: classify({
            length: med(samples.map((s) => s.length)),
            forehead: med(samples.map((s) => s.forehead)),
            jaw: med(samples.map((s) => s.jaw)),
          }),
          skinTone: skinLabel(skin),
        };
        setFaceMetrics(metrics);
        if (onFaceScanned) onFaceScanned(metrics);
      }
    };

    const vv = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (time: number) => void) => number;
    };
    const schedule = () => {
      if (vv.requestVideoFrameCallback) vv.requestVideoFrameCallback(onFrame);
      else requestAnimationFrame((t) => onFrame(t));
    };
    schedule();
  }

  return (
    <div
      ref={boxRef}
      className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-neutral-800"
      style={{ aspectRatio: aspect }}
    >
      {status === "running" && faceMetrics && (
        <div className="absolute left-4 top-4 z-20 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur-md">
          Shape: <span className="font-semibold text-emerald-400">{faceMetrics.shape}</span> Tone:{" "}
          <span className="font-semibold text-amber-400">{faceMetrics.skinTone}</span>
        </div>
      )}
      {status === "running" && !faceMetrics && (
        <div className="absolute left-4 top-4 z-20 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur-md">
          Look straight at the camera… {Math.round(scan * 100)}%
        </div>
      )}

      {status === "running" && (
        <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2">
          <button
            onClick={() => setFitOpen((o) => !o)}
            className="rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur-md hover:bg-black/80"
          >
            ⚙ Fit
          </button>
          {fitOpen && (
            <div className="w-56 rounded-xl border border-white/10 bg-black/75 p-3 text-[11px] text-white backdrop-blur-md">
              {FIT_SLIDERS.map((s) => (
                <label key={s.key} className="mb-2 block">
                  <span className="flex justify-between text-neutral-300">
                    {s.label}
                    <span>{fit[s.key].toFixed(2)}</span>
                  </span>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={fit[s.key]}
                    onChange={(e) => setFitValue(s.key, parseFloat(e.target.value))}
                    className="w-full"
                  />
                </label>
              ))}
              <button
                onClick={() => (Object.keys(FIT_DEFAULTS) as FitKey[]).forEach((k) => setFitValue(k, FIT_DEFAULTS[k]))}
                className="mt-1 text-neutral-400 underline hover:text-white"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      {/* Video & 3D AR Scene Container (Flipped for mirror view) */}
      <div className="absolute inset-0" style={{ transform: "scaleX(-1)" }}>
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-fill" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ filter: "blur(0.4px)" }}
        />
      </div>

      {/* Wireframe Mesh Canvas placed OUTSIDE the flipped container so it tracks facial landmarks 1:1 */}
      <canvas
        ref={hudCanvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none z-20 scaleX(-1)"
        style={{ transform: "scaleX(-1)" }}
      />

      {status === "running" && (
        <AIStylistOverlay
          currentProduct={product}
          currentKey={productKey}
          currentColor={currentColorName}
          onSelectFrame={onSelectFrame}
          onSelectColor={onSelectColor}
          faceMetrics={faceMetrics}
        />
      )}

      {status !== "running" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-900/80 p-6 text-center">
          {status === "loading" ? (
            <p className="text-neutral-300">Starting camera and face tracking…</p>
          ) : (
            <button
              onClick={start}
              className="rounded-full bg-white px-8 py-4 font-medium text-neutral-950 transition hover:bg-neutral-200"
            >
              📷 Launch Live Camera Try-On
            </button>
          )}
          {message && <p className="max-w-md text-sm text-red-400">{message}</p>}
        </div>
      )}
    </div>
  );
}
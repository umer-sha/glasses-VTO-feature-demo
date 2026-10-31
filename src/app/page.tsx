"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { glasses } from "@/lib/glasses";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function Catalog3DCanvas({ modelUrl, turn = 0 }: { modelUrl: string; turn?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Position camera slightly further away so the whole frame fits perfectly
    camera.position.set(0, 0, 1.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Add Blender-like OrbitControls for mouse interaction (rotate, pan, zoom)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(2, 2, 2);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight2.position.set(-2, -2, -2);
    scene.add(dirLight2);

    const loader = new GLTFLoader();

    loader.load(
      modelUrl,
      (gltf) => {
        const modelNode = gltf.scene;
        const box = new THREE.Box3().setFromObject(modelNode);
        const center = box.getCenter(new THREE.Vector3());
        modelNode.position.sub(center);
        modelNode.rotation.y = turn;
        scene.add(modelNode);
      },
      undefined,
      (err) => console.error("GLTF load error:", err)
    );

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update(); // Update orbit controls each frame
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelUrl, turn]);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />;
}

export default function CatalogPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isDark = theme === "dark";

  return (
    <main className={`min-h-screen flex flex-col justify-between p-8 md:p-12 transition-colors duration-300 ${
      isDark ? "bg-neutral-950 text-neutral-100" : "bg-neutral-50 text-neutral-900"
    }`}>
      <header className={`max-w-6xl mx-auto w-full flex items-center justify-between border-b pb-6 ${
        isDark ? "border-neutral-800" : "border-neutral-200"
      }`}>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={`group flex items-center justify-center p-2.5 rounded-2xl border transition-all duration-300 shadow-sm ${
            isDark
              ? "bg-neutral-900/80 border-neutral-800 text-amber-400 hover:border-amber-400/50"
              : "bg-white border-neutral-300 text-amber-600 hover:border-amber-500/50"
          }`}
          title="Toggle Theme"
        >
          {isDark ? "☀️" : "🌙"}
        </button>

        <span className="text-sm tracking-[0.4em] uppercase font-mono text-amber-400">
          REALMEN LUXURY
        </span>

        <span className="text-xs tracking-widest font-mono hidden sm:inline opacity-70">
          VIRTUAL TRY-ON STUDIO
        </span>
      </header>

      <section className="max-w-6xl mx-auto w-full py-12">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className={`text-4xl md:text-5xl font-extralight tracking-tight mb-4 ${isDark ? "text-white" : "text-black"}`}>
            Next-Generation <span className="text-amber-400 font-normal">WebAR</span> Collection
          </h1>
          <p className={`text-sm md:text-base font-light ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
            Experience our luxury frames live in interactive 3D and augmented reality powered by AI face analysis. All frames priced at $64.00.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Object.entries(glasses).map(([key, g]) => (
            <div
              key={key}
              className={`group rounded-3xl border p-6 flex flex-col justify-between backdrop-blur-xl transition-all duration-500 shadow-xl ${
                isDark
                  ? "bg-neutral-900/60 border-neutral-800 hover:border-amber-400/50 hover:shadow-amber-400/5"
                  : "bg-white border-neutral-200 hover:border-amber-500/50 hover:shadow-neutral-300"
              }`}
            >
              <div>
                {/* Interactive 3D Orbit Model Box */}
                <div className={`aspect-[4/3] rounded-2xl border mb-6 flex items-center justify-center overflow-hidden relative shadow-inner ${
                  isDark ? "bg-neutral-950/80 border-neutral-800/60" : "bg-neutral-100 border-neutral-200"
                }`}>
                  <Catalog3DCanvas modelUrl={g.model} turn={g.turn} />
                  <div className="absolute bottom-3 right-3 pointer-events-none text-[9px] uppercase tracking-widest font-mono bg-neutral-900/80 text-amber-400 px-2 py-0.5 rounded border border-neutral-800 opacity-60">
                    Interactive 3D
                  </div>
                </div>
                <h2 className={`text-xl font-light mb-1 transition-colors ${
                  isDark ? "text-white group-hover:text-amber-400" : "text-black group-hover:text-amber-600"
                }`}>
                  {g.name}
                </h2>
                <p className="text-amber-400 font-mono font-medium text-lg mb-4">
                  ${g.price}.00
                </p>
              </div>

              <div className={`flex flex-col gap-3 pt-4 border-t ${isDark ? "border-neutral-800/80" : "border-neutral-200"}`}>
                <Link
                  href={`/select-color?id=${key}`}
                  className="w-full py-3.5 rounded-xl bg-amber-400 text-neutral-950 font-semibold text-xs uppercase tracking-widest text-center hover:bg-amber-300 transition-all shadow-lg shadow-amber-400/10"
                >
                  Launch Virtual Try-On
                </Link>
                <a
                  href={g.hostingerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full py-3 rounded-xl border text-xs uppercase tracking-widest text-center transition-all ${
                    isDark
                      ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white"
                      : "bg-neutral-100 border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:text-black"
                  }`}
                >
                  View on Store ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className={`max-w-6xl mx-auto w-full text-center text-xs pt-8 border-t font-mono ${
        isDark ? "border-neutral-800 text-neutral-500" : "border-neutral-200 text-neutral-400"
      }`}>
        © 2026 RealMen Luxury. Powered by Innovibe Digital.
      </footer>
    </main>
  );
}
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { glasses } from "@/lib/glasses";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function Glasses3DCanvas({ modelUrl, turn = 0 }: { modelUrl: string; turn?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 0.85);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(2, 2, 2);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight2.position.set(-2, -2, -2);
    scene.add(dirLight2);

    let modelNode: THREE.Object3D | null = null;
    const loader = new GLTFLoader();

    loader.load(
      modelUrl,
      (gltf) => {
        modelNode = gltf.scene;
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
      if (modelNode) {
        modelNode.rotation.y += 0.005;
      }
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
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelUrl, turn]);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
}

function SelectColorContent({ isDark }: { isDark: boolean }) {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "aviator";
  const product = glasses[id] || glasses["aviator"];

  return (
    <section className="my-auto max-w-xl mx-auto text-center px-4 w-full">
      <div className={`mb-8 flex aspect-[3/2] items-center justify-center rounded-3xl border backdrop-blur-xl overflow-hidden relative shadow-2xl ${
        isDark ? "bg-neutral-900/60 border-neutral-800" : "bg-neutral-200/60 border-neutral-300"
      }`}>
        <Glasses3DCanvas modelUrl={product.model} turn={product.turn} />
        <div className={`absolute top-4 left-4 text-[10px] uppercase tracking-[0.2em] font-mono px-3 py-1 rounded-full border ${
          isDark ? "bg-neutral-950/80 border-neutral-800 text-neutral-400" : "bg-white/80 border-neutral-300 text-neutral-600"
        }`}>
          3D Preview
        </div>
      </div>

      <h1 className={`text-3xl font-light tracking-wide mb-2 ${isDark ? "text-neutral-100" : "text-neutral-900"}`}>{product.name}</h1>
      <p className="text-amber-400 font-medium text-2xl mb-8">${product.price}.00 USD</p>

      <div className={`mb-4 text-xs uppercase tracking-[0.25em] font-mono ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
        Select Finish & Launch AR
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {product.colors?.map((colorOption, idx) => (
          <Link
            key={idx}
            href={`/try-on?id=${id}&color=${encodeURIComponent(colorOption.name)}`}
            className={`group flex items-center gap-3 px-6 py-3.5 rounded-2xl border backdrop-blur-md transition-all duration-300 text-sm ${
              colorOption.original
                ? isDark
                  ? "border-amber-400/50 bg-neutral-900/90 text-white shadow-lg shadow-amber-500/10 hover:border-amber-400"
                  : "border-amber-500/80 bg-white text-neutral-900 shadow-md hover:border-amber-500"
                : isDark
                ? "border-neutral-800 bg-neutral-900/50 text-neutral-300 hover:border-neutral-600 hover:text-white"
                : "border-neutral-300 bg-neutral-100 text-neutral-700 hover:border-neutral-400 hover:text-black"
            }`}
          >
            <span
              className="w-4 h-4 rounded-full border border-neutral-700 shadow-inner group-hover:scale-110 transition-transform"
              style={{ backgroundColor: colorOption.hex }}
            />
            <span className="font-medium">{colorOption.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function SelectColorPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isDark = theme === "dark";

  return (
    <main className={`min-h-screen flex flex-col justify-between p-6 transition-colors duration-300 ${
      isDark ? "bg-neutral-950 text-neutral-100" : "bg-neutral-50 text-neutral-900"
    }`}>
      <header className={`border-b pb-5 flex items-center justify-between px-4 ${
        isDark ? "border-neutral-800/80" : "border-neutral-200"
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

        <span className="text-xs tracking-[0.4em] uppercase font-light">
          RealMen Luxury Studio
        </span>

        <div className="w-10" />
      </header>

      <Suspense fallback={<div className="text-center my-auto text-neutral-500 font-mono text-sm">Loading 3D Studio...</div>}>
        <SelectColorContent isDark={isDark} />
      </Suspense>

      <footer className="text-center text-xs text-neutral-500 pb-4">
        <Link href="/" className="hover:text-neutral-300 transition underline underline-offset-4">
          Back to Store Catalog
        </Link>
      </footer>
    </main>
  );
}
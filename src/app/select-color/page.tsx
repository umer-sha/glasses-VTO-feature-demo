"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { glasses } from "@/lib/glasses";
import { Suspense, useEffect, useRef } from "react";
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
    // Move camera back slightly and lower it so model sits lower & centered
    camera.position.set(0, 0, 0.85);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight1.position.set(2, 2, 2);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight2.position.set(-2, -2, -2);
    scene.add(dirLight2);

    let modelNode: THREE.Object3D | null = null;
    const loader = new GLTFLoader();

    loader.load(
      modelUrl,
      (gltf) => {
        modelNode = gltf.scene;

        // Auto-center the loaded 3D bounding box
        const box = new THREE.Box3().setFromObject(modelNode);
        const center = box.getCenter(new THREE.Vector3());
        modelNode.position.sub(center);

        // Turn frame towards viewer
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

function SelectColorContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "aviator";
  const product = glasses[id] || glasses["aviator"];

  return (
    <section className="my-auto max-w-xl mx-auto text-center px-4 w-full">
      <div className="mb-6 flex aspect-[3/2] items-center justify-center rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden relative shadow-2xl">
        <Glasses3DCanvas modelUrl={product.model} turn={product.turn} />
      </div>

      <h1 className="text-3xl font-light mb-1">{product.name}</h1>
      <p className="text-neutral-400 text-lg mb-8">${product.price}</p>

      <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-4 font-mono">Select Finish / Color</h3>

      <div className="flex flex-wrap justify-center gap-4">
        {product.colors?.map((colorOption, idx) => (
          <Link
            key={idx}
            href={`/try-on?id=${id}&color=${encodeURIComponent(colorOption.name)}`}
            className={`flex items-center gap-3 px-6 py-3 rounded-full border transition text-sm ${
              colorOption.original
                ? "border-amber-400/60 bg-neutral-900 hover:border-amber-400"
                : "border-neutral-800 bg-neutral-900 hover:border-neutral-500"
            }`}
          >
            <span
              className="w-4 h-4 rounded-full border border-neutral-600 shadow-inner"
              style={{ backgroundColor: colorOption.hex }}
            />
            <span>{colorOption.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function SelectColorPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between p-6">
      <header className="border-b border-neutral-800 pb-4 text-lg font-light tracking-[0.3em] text-center">
        INNOVIBE STUDIOS
      </header>

      <Suspense fallback={<div className="text-center my-auto text-neutral-500 font-mono text-sm">Loading 3D Product...</div>}>
        <SelectColorContent />
      </Suspense>

      <footer className="text-center text-xs text-neutral-500 pb-4">
        <Link href="/" className="underline hover:text-neutral-300">
          Back to Catalog
        </Link>
      </footer>
    </main>
  );
}
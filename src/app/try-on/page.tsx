"use client";

import { use, useState, Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { glasses } from "@/lib/glasses";

const TryOnView = dynamic(() => import("@/components/TryOnView"), { ssr: false });

const FRAME_NAMES: Record<string, string> = {
  aviator: "Luxe Square Aviator Sunglasses",
  tortoise: "Retro Oval Sunglasses",
  wire: "Geometric Navigator Sunglasses",
};

function getSingleRecommendation(shape: string, skinTone: string) {
  let frame = "aviator";
  let why = "Your balanced features look incredible with classic proportions.";

  if (shape === "Square" || shape === "Diamond") {
    frame = "wire";
    why = "Geometric navigator frames soften sharp angles and a strong jawline.";
  } else if (shape === "Round" || shape === "Oblong") {
    frame = "tortoise";
    why = "Retro oval frames add definition and contrast to softer facial curves.";
  } else if (shape === "Heart") {
    frame = "aviator";
    why = "Luxe square aviators balance a broader forehead with a tapered chin.";
  }

  const t = skinTone.toLowerCase();
  const warm = t.includes("warm");
  let color = warm ? "Gold / Tinted" : "Silver / Smoke";
  let colorWhy = warm ? "Gold tones elevate warm skin tones." : "Silver tones contrast cleanly with cool tones.";

  if (frame === "tortoise") {
    color = "Tortoiseshell";
    colorWhy = "Deep tortoiseshell tones match your skin profile richly.";
  }

  return { frame, color, reason: `${why} ${colorWhy}` };
}

function TryOnContent({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; color?: string }>;
}) {
  const params = use(searchParams);
  
  const initialKey = params.id && glasses[params.id] ? params.id : "aviator";
  const [frameKey, setFrameKey] = useState<string>(initialKey);
  const [colorName, setColorName] = useState<string>(params.color ?? "");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [faceMetrics, setFaceMetrics] = useState<{ shape: string; skinTone: string } | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  const product = glasses[frameKey] || glasses["aviator"];
  const productColors = product?.colors ?? [];

  const active =
    productColors.find(
      (c) => c.name.toLowerCase() === colorName.toLowerCase()
    ) ?? productColors[0] ?? { name: product?.color || "Default", hex: product?.color || "#1c1c1c", original: true };

  function pickFrame(key: string) {
    setFrameKey(key);
    const newProduct = glasses[key];
    if (newProduct && newProduct.colors && newProduct.colors.length > 0) {
      setColorName(newProduct.colors[0].name);
    } else {
      setColorName("");
    }
  }

  const isDark = theme === "dark";
  const rec = faceMetrics ? getSingleRecommendation(faceMetrics.shape, faceMetrics.skinTone) : null;

  const applyRecommendation = () => {
    if (!rec) return;
    pickFrame(rec.frame);
    setColorName(rec.color);
  };

  return (
    <main className={`min-h-screen transition-colors duration-500 ${isDark ? "bg-neutral-950 text-neutral-100" : "bg-neutral-50 text-neutral-900"}`}>
      {/* Luxury Header */}
      <header className={`flex items-center justify-between border-px px-8 py-5 backdrop-blur-xl sticky top-0 z-40 ${isDark ? "border-neutral-800/80 bg-neutral-950/80" : "border-neutral-200/80 bg-white/80"}`}>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={`group flex items-center justify-center p-2.5 rounded-2xl border transition-all duration-300 shadow-sm ${
            isDark
              ? "bg-neutral-900/80 border-neutral-800 text-amber-400 hover:border-amber-400/50"
              : "bg-white border-neutral-200 text-amber-600 hover:border-amber-500/50"
          }`}
          title="Toggle Theme"
        >
          {isDark ? "☀️" : "🌙"}
        </button>

        <div className="text-xs uppercase tracking-[0.4em] font-light text-amber-400/90 font-mono">
          REALMEN LUXURY • VTO STUDIO
        </div>

        <Link 
          href="/" 
          className={`text-xs uppercase tracking-widest font-medium transition px-4 py-2 rounded-xl border ${
            isDark ? "border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 bg-neutral-900/50" : "border-neutral-200 text-neutral-600 hover:text-black hover:border-neutral-300 bg-neutral-100/50"
          }`}
        >
          Catalog ↗
        </Link>
      </header>

      <section className="px-6 py-6 max-w-4xl mx-auto">
        {/* AR Camera Container */}
        <div className="rounded-3xl overflow-hidden border border-neutral-800/80 shadow-2xl bg-neutral-900 relative">
          <TryOnView
            product={product}
            color={active.original ? null : active.hex}
            productKey={frameKey}
            currentColorName={active.name}
            onSelectFrame={pickFrame}
            onSelectColor={setColorName}
            theme={theme}
            onFaceScanned={setFaceMetrics}
          />
        </div>

        {/* AI Recommendation Banner */}
        {faceMetrics && rec && showBanner && (
          <div className="mx-auto mt-5 rounded-2xl border border-amber-400/30 bg-neutral-900/90 p-5 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-semibold font-mono">
                ✦ AI Optician Match: {faceMetrics.shape} Face ({faceMetrics.skinTone})
              </div>
              <div className="text-sm font-medium text-white mt-1">
                Recommended: {FRAME_NAMES[rec.frame]}
              </div>
              <div className="text-xs text-neutral-400 mt-0.5">{rec.reason}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={applyRecommendation}
                className="px-5 py-2.5 bg-amber-400 text-neutral-950 font-semibold text-xs rounded-xl hover:bg-amber-300 transition shadow-lg shadow-amber-400/20 uppercase tracking-wider"
              >
                Try Frame
              </button>
              <button onClick={() => setShowBanner(false)} className="text-neutral-500 hover:text-white text-sm p-1.5">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Frame Selector Carousel */}
        <div className="mt-8 bg-neutral-900/40 border border-neutral-800/60 rounded-3xl p-6 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-[0.25em] text-neutral-400 font-mono">
              Select Frame Style ($64.00)
            </span>
            <span className="text-xs text-amber-400/90 font-mono">
              Active: {product.name}
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {Object.entries(glasses).map(([key, g]) => (
              <button
                key={key}
                onClick={() => pickFrame(key)}
                className={`shrink-0 rounded-2xl border px-6 py-3.5 text-xs uppercase tracking-wider transition-all duration-300 ${
                  key === frameKey
                    ? "border-amber-400 bg-amber-400 text-neutral-950 font-semibold shadow-lg shadow-amber-400/20 scale-[1.02]"
                    : "border-neutral-800 bg-neutral-900/80 text-neutral-300 hover:border-neutral-700 hover:text-white"
                }`}
              >
                {g.name.replace("Sunglasses", "").trim()}
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-800/80">
            <div className="text-xs uppercase tracking-[0.25em] text-neutral-400 font-mono mb-3">
              Finish & Color: <span className="text-white font-medium">{active.name}</span>
            </div>
            <div className="flex gap-3.5">
              {productColors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColorName(c.name)}
                  title={c.name}
                  className={`h-11 w-11 rounded-2xl border-2 transition-all duration-300 flex items-center justify-center ${
                    active.name === c.name
                      ? "scale-110 border-amber-400 shadow-lg shadow-amber-400/20 ring-2 ring-amber-400/30"
                      : "border-neutral-700/80 hover:border-neutral-500"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function TryOnPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; color?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-amber-400 font-mono text-xs uppercase tracking-widest">Loading Luxury AR Studio...</div>}>
      <TryOnContent searchParams={searchParams} />
    </Suspense>
  );
}
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
  
  // Safe initial frame key lookup
  const initialKey = params.id && glasses[params.id] ? params.id : "aviator";
  const [frameKey, setFrameKey] = useState<string>(initialKey);
  const [colorName, setColorName] = useState<string>(params.color ?? "");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [faceMetrics, setFaceMetrics] = useState<{ shape: string; skinTone: string } | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  // Safe product fallback
  const product = glasses[frameKey] || glasses["aviator"];
  const productColors = product?.colors ?? [];

  // Safe active color calculation
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
    <main className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-neutral-950 text-neutral-100" : "bg-neutral-100 text-neutral-900"}`}>
      <header className={`flex items-center justify-between border-b px-6 py-4 ${isDark ? "border-neutral-800" : "border-neutral-200"}`}>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={`group flex items-center justify-center p-2.5 rounded-full border transition-all duration-300 shadow-md ${
            isDark
              ? "bg-neutral-900 border-neutral-700 text-amber-400 hover:bg-neutral-800 hover:border-neutral-600"
              : "bg-white border-neutral-300 text-indigo-600 hover:bg-neutral-50 hover:border-neutral-400"
          }`}
          title="Toggle Theme"
          aria-label="Toggle Theme"
        >
          {isDark ? (
            <svg className="w-5 h-5 transition-transform duration-500 group-hover:rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 transition-transform duration-500 group-hover:-rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <div className="text-sm font-light tracking-[0.3em] uppercase">INNOVIBE STUDIOS</div>

        <Link href="/" className={`text-sm font-medium transition ${isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-black"}`}>
          ← Back
        </Link>
      </header>

      <section className="px-6 py-8">
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

        {/* RECOMMENDATION TAB PLACED EXACTLY BELOW CAMERA & ABOVE FRAMES */}
        {faceMetrics && rec && showBanner && (
          <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-md text-left flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
                ★ Best Match for your {faceMetrics.shape} face ({faceMetrics.skinTone})
              </div>
              <div className="text-xs font-semibold text-white mt-0.5">
                {FRAME_NAMES[rec.frame]} ({rec.color})
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">{rec.reason}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={applyRecommendation}
                className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-neutral-200 transition shadow"
              >
                Try This
              </button>
              <button onClick={() => setShowBanner(false)} className="text-neutral-500 hover:text-white text-xs p-1">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Frame Selection Carousel */}
        <div className="mx-auto mt-6 max-w-3xl">
          <p className="text-sm uppercase tracking-widest text-neutral-500">Frames</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {Object.entries(glasses).map(([key, g]) => (
              <button
                key={key}
                onClick={() => pickFrame(key)}
                className={`shrink-0 rounded-full border px-5 py-2 text-sm transition ${
                  key === frameKey
                    ? isDark
                      ? "border-white bg-white text-neutral-950 font-medium"
                      : "border-black bg-neutral-950 text-white font-medium"
                    : isDark
                    ? "border-neutral-700 text-neutral-300 hover:border-neutral-400"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm uppercase tracking-widest text-neutral-500">
            Colour: {active.name}
          </p>
          <div className="mt-3 flex gap-4">
            {productColors.map((c) => (
              <button
                key={c.name}
                onClick={() => setColorName(c.name)}
                title={c.name}
                aria-label={c.name}
                className={`h-10 w-10 rounded-full border-2 transition ${
                  active.name === c.name
                    ? "scale-110 border-white shadow-md"
                    : isDark ? "border-neutral-700 hover:border-neutral-400" : "border-neutral-300 hover:border-neutral-500"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
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
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400 font-mono text-sm">Loading Try-On Experience...</div>}>
      <TryOnContent searchParams={searchParams} />
    </Suspense>
  );
}
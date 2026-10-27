"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { glasses } from "@/lib/glasses";
import { Suspense } from "react";

function GlassesSVG({ shape, color }: { shape: string; color: string }) {
  const s = { stroke: color, strokeWidth: 7, fill: "rgba(180,210,255,0.12)" };
  return (
    <svg viewBox="0 0 300 120" className="w-3/5 mx-auto">
      {shape === "round" && (<><circle cx="82" cy="62" r="38" {...s} /><circle cx="218" cy="62" r="38" {...s} /></>)}
      {shape === "rect" && (<><rect x="24" y="32" width="102" height="62" rx="14" {...s} /><rect x="174" y="32" width="102" height="62" rx="14" {...s} /></>)}
      {shape === "aviator" && (<><path d="M28 34H126Q134 34 132 46Q124 98 80 98Q36 98 26 46Q24 34 28 34Z" {...s} /><path d="M174 34H272Q276 34 274 46Q264 98 220 98Q176 98 168 46Q166 34 174 34Z" {...s} /></>)}
      <path d="M126 52Q150 36 174 52" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <path d="M24 44L6 36M276 44L294 36" stroke={color} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

function SelectColorContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "aviator";
  const product = glasses[id];

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 my-auto">
        <h1 className="text-2xl font-light mb-4">Product not found</h1>
        <Link href="/" className="text-sm underline text-neutral-400">
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <section className="my-auto max-w-xl mx-auto text-center px-4">
      <div className="mb-6 flex aspect-[3/2] items-center justify-center rounded-2xl bg-neutral-900 border border-neutral-800">
        <GlassesSVG shape={product.shape} color={product.color} />
      </div>

      <h1 className="text-3xl font-light mb-1">{product.name}</h1>
      <p className="text-neutral-400 text-lg mb-8">${product.price}</p>

      <h3 className="text-sm uppercase tracking-widest text-neutral-400 mb-4">Select Finish / Color</h3>
      
      <div className="flex flex-wrap justify-center gap-4">
        {product.colors?.map((colorOption, idx) => (
          <Link
            key={idx}
            href={`/try-on?id=${id}&color=${idx}`}
            className="flex items-center gap-3 px-6 py-3 rounded-full border border-neutral-700 bg-neutral-900 hover:border-neutral-400 transition"
          >
            <span 
              className="w-4 h-4 rounded-full border border-neutral-600" 
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
      <header className="border-b border-neutral-800 pb-4 text-lg font-light tracking-[0.3em]">
        INNOVIBE STUDIOS
      </header>

      <Suspense fallback={<div className="text-center my-auto text-neutral-500">Loading product options...</div>}>
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
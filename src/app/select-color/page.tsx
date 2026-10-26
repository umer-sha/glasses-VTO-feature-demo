"use client";

import { use, useState } from "react";
import Link from "next/link";
import GlassesViewer from "@/components/GlassesViewer";
import { getGlasses } from "@/lib/glasses";

export default function SelectColor({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = use(searchParams);
  const { key, product } = getGlasses(id);
  const [selected, setSelected] = useState("Original");
  const active = product.colors.find((c) => c.name === selected) ?? product.colors[0];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-5">
        <Link href="/" className="text-lg font-light uppercase tracking-[0.3em]">
          Lumière
        </Link>
        <Link href="/" className="text-sm text-neutral-400 hover:text-white">
          ← Back
        </Link>
      </header>

      <section className="mx-auto grid max-w-5xl gap-12 px-6 py-16 md:grid-cols-2">
        <div className="h-80 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 md:h-96">
          <GlassesViewer
            key={product.model}
            url={product.model}
            color={active.original ? null : active.hex}
            recolor={product.recolor}
            lens={product.lens}
            hide={product.hide}
            turn={product.turn}
          />
        </div>

        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-light">{product.name}</h1>
          <p className="mt-2 text-xl text-neutral-300">${product.price}</p>

          <p className="mt-10 text-sm uppercase tracking-widest text-neutral-500">
            Colour: {active.name}
          </p>
          <div className="mt-4 flex gap-4">
            {product.colors.map((c) => (
              <button
                key={c.name}
                onClick={() => setSelected(c.name)}
                title={c.name}
                aria-label={c.name}
                className={`h-11 w-11 rounded-full border-2 transition ${
                  active.name === c.name
                    ? "scale-110 border-white"
                    : "border-neutral-700 hover:border-neutral-400"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>

          <div className="mt-10">
            <Link
              href={`/try-on?id=${key}&color=${encodeURIComponent(active.name)}`}
              className="inline-block rounded-full bg-white px-8 py-4 font-medium text-neutral-950 hover:bg-neutral-200"
            >
              📷 Try On
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
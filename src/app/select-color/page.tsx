"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { glasses } from "@/lib/glasses";

export default function SelectColorPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "aviator";
  const product = glasses[id];

  // Safe fallback if product doesn't exist
  if (!product) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-light mb-4">Product not found</h1>
        <Link href="/" className="text-sm underline text-neutral-400">
          Return to Home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between p-6">
      <header className="border-b border-neutral-800 pb-4 text-lg font-light tracking-[0.3em]">
        INNOVIBE STUDIOS
      </header>

      <section className="my-auto max-w-xl mx-auto text-center">
        <h1 className="text-3xl font-light mb-2">{product.name}</h1>
        <p className="text-neutral-400 mb-8">${product.price}</p>

        <div className="flex flex-wrap justify-center gap-4">
          {product.colors?.map((colorOption, idx) => (
            <Link
              key={idx}
              href={`/try-on?id=${id}&color=${idx}`}
              className="px-6 py-3 rounded-full border border-neutral-700 bg-neutral-900 hover:border-neutral-400 transition"
            >
              {colorOption.name}
            </Link>
          ))}
        </div>
      </section>

      <footer className="text-center text-xs text-neutral-500 pb-4">
        <Link href="/" className="underline hover:text-neutral-300">
          Back to Catalog
        </Link>
      </footer>
    </main>
  );
}
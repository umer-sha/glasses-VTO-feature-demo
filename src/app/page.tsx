import Link from "next/link";

const glasses = [
  { id: "aviator", name: "Luxe Square Aviator Sunglasses", price: 149, shape: "aviator", color: "#d4af37" },
  { id: "tortoise", name: "Retro Oval Sunglasses", price: 169, shape: "round", color: "#8b5a2b" },
  { id: "wire", name: "Geometric Navigator Sunglasses", price: 139, shape: "rect", color: "#1c1c1c" },
];

function GlassesSVG({ shape, color }: { shape: string; color: string }) {
  const s = { stroke: color, strokeWidth: 7, fill: "rgba(180,210,255,0.12)" };
  return (
    <svg viewBox="0 0 300 120" className="w-4/5">
      {shape === "round" && (<><circle cx="82" cy="62" r="38" {...s} /><circle cx="218" cy="62" r="38" {...s} /></>)}
      {shape === "rect" && (<><rect x="24" y="32" width="102" height="62" rx="14" {...s} /><rect x="174" y="32" width="102" height="62" rx="14" {...s} /></>)}
      {shape === "aviator" && (<><path d="M28 34H126Q134 34 132 46Q124 98 80 98Q36 98 26 46Q24 34 28 34Z" {...s} /><path d="M174 34H272Q276 34 274 46Q264 98 220 98Q176 98 168 46Q166 34 174 34Z" {...s} /></>)}
      <path d="M126 52Q150 36 174 52" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <path d="M24 44L6 36M276 44L294 36" stroke={color} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-5 text-lg font-light tracking-[0.3em]">
        INNOVIBE STUDIOS
      </header>

      <section className="px-6 py-20 text-center">
        <h1 className="text-4xl font-light sm:text-6xl">
          Find Your Perfect Frames.
          <br />
          <span className="text-neutral-400">Try Them On Live.</span>
        </h1>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {glasses.map((g) => (
          <Link
            key={g.id}
            href={`/select-color?id=${g.id}`}
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 transition hover:border-neutral-500"
          >
            <div className="flex aspect-[3/2] items-center justify-center rounded-xl bg-neutral-950">
              <GlassesSVG shape={g.shape} color={g.color} />
            </div>
            <h2 className="mt-5 text-lg font-light">{g.name}</h2>
            <p className="text-sm text-neutral-400">${g.price}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
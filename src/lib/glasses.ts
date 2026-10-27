export interface Glasses {
  name: string;
  model: string;
  price: number;
  shape: string;
  color: string;
  turn?: number;
  lens?: string[];
  hide?: string[];
  recolor?: string[];
  colors?: { name: string; hex: string; original?: boolean }[];
}

export const glasses: Record<string, Glasses> = {
  aviator: {
    name: "Luxe Square Aviator Sunglasses",
    model: "/models/glasses.glb",
    price: 149,
    shape: "aviator",
    color: "#d4af37",
    turn: 0,
    colors: [
      { name: "Gold / Tinted", hex: "#d4af37", original: true },
      { name: "Silver / Smoke", hex: "#c0c0c0" },
      { name: "Matte Black", hex: "#1c1c1c" }
    ],
  },
  tortoise: {
    name: "Retro Oval Sunglasses",
    model: "/models/glasses1.glb",
    price: 169,
    shape: "round",
    color: "#8b5a2b",
    turn: -Math.PI / 2,
    colors: [
      { name: "Tortoiseshell", hex: "#8b5a2b", original: true },
      { name: "Amber Brown", hex: "#ffbf00" },
      { name: "Classic Black", hex: "#111111" }
    ],
  },
  wire: {
    name: "Geometric Navigator Sunglasses",
    model: "/models/glasses2.glb",
    price: 139,
    shape: "rect",
    color: "#1c1c1c",
    turn: -Math.PI / 2,
    colors: [
      { name: "Gunmetal Wire", hex: "#1c1c1c", original: true },
      { name: "Rose Gold", hex: "#b76e79" },
      { name: "Yellow Gold", hex: "#d4af37" }
    ],
  },
};

// finds a product from the ?id= in the link (old ids still work)
export function getGlasses(id?: string) {
  const key = id === "black" || id === "heartglasses" ? "wire" : id ?? "";
  return glasses[key]
    ? { key, product: glasses[key] }
    : { key: "aviator", product: glasses.aviator };
}
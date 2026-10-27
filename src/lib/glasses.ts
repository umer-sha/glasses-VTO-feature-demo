const MODELS = "/models";

export type Swatch = { name: string; hex: string; original?: boolean };
export interface Glasses {
  name: string;
  model: string;
  price: number;
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
    turn: 0,
    // keep your existing colors, lens, recolor definitions below
  },
  tortoise: {
    name: "Retro Oval Sunglasses",
    model: "/models/glasses1.glb",
    price: 169,
    turn: -Math.PI / 2,
    // keep your existing colors, lens, recolor definitions below
  },
  wire: {
    name: "Geometric Navigator Sunglasses",
    model: "/models/glasses2.glb",
    price: 139,
    turn: -Math.PI / 2,
    // keep your existing colors, lens, recolor definitions below
  },
};

// finds a product from the ?id= in the link (old ids still work)
export function getGlasses(id?: string) {
  const key = id === "black" || id === "heartglasses" ? "wire" : id ?? "";
  return glasses[key]
    ? { key, product: glasses[key] }
    : { key: "aviator", product: glasses.aviator };
}
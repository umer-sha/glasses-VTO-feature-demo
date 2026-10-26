const MODELS = "/models";

export type Swatch = { name: string; hex: string; original?: boolean };

export type Glasses = {
  name: string;
  price: number;
  model: string;
  recolor: string[]; // material names that change colour
  lens?: string[]; // material names made see-through
  hide?: string[]; // material names hidden completely
  turn?: number; // turn around the vertical axis so the front faces the camera
  colors: Swatch[];
};

export const glasses: Record<string, Glasses> = {
  aviator: {
    name: "Classic Aviator",
    price: 149,
    model: `${MODELS}/glasses.glb`,
    recolor: ["Frame", "Handles"],
    colors: [
      { name: "Original", hex: "#111111", original: true },
      { name: "Gold", hex: "#d4af37" },
      { name: "Silver", hex: "#c0c0c0" },
      { name: "Rose Gold", hex: "#b76e79" },
    ],
  },
  tortoise: {
    name: "Tortoiseshell",
    price: 129,
    model: `${MODELS}/glasses1.glb`,
    recolor: ["plastik"],
    turn: -Math.PI / 2,
    colors: [
      { name: "Original", hex: "#1a1a1a", original: true },
      { name: "Havana", hex: "#8b5a2b" },
      { name: "Amber", hex: "#c68e17" },
      { name: "Espresso", hex: "#4a2c17" },
    ],
  },
  wire: {
    name: "Round Wire",
    price: 139,
    model: `${MODELS}/glasses2.glb`,
    recolor: ["daz__F05", "daz__A06"],
    hide: ["daz__E04"],
    turn: Math.PI / 2,
    colors: [
      { name: "Original", hex: "#d8d4cc", original: true },
      { name: "Gold", hex: "#d4af37" },
      { name: "Rose Gold", hex: "#b76e79" },
      { name: "Black", hex: "#1c1c1c" },
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
export interface Glasses {
  name: string;
  model: string;
  price: number;
  shape: string;
  color: string;
  hostingerUrl: string;
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
    color: "#1c1c1c", // Default Matte Black
    hostingerUrl: "https://realmenluxury.fashion/luxury-gold-frame-square-sunglasses",
    turn: 0,
    colors: [
      { name: "Matte Black", hex: "#1c1c1c", original: true },
      { name: "Gold / Tinted", hex: "#d4af37" },
      { name: "Silver / Smoke", hex: "#c0c0c0" }
    ],
  },
  tortoise: {
    name: "Retro Oval Sunglasses",
    model: "/models/glasses1.glb",
    price: 169,
    shape: "round",
    color: "#8b5a2b",
    hostingerUrl: "https://realmenluxury.fashion/retro-oval-gold-sunglasses",
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
    hostingerUrl: "https://realmenluxury.fashion/retro-square-navigator-sunglasses",
    turn: -Math.PI / 2,
    colors: [
      { name: "Gunmetal Wire", hex: "#1c1c1c", original: true },
      { name: "Rose Gold", hex: "#b76e79" },
      { name: "Yellow Gold", hex: "#d4af37" }
    ],
  },
};

export function getGlasses(id?: string): Glasses {
  if (id && glasses[id]) {
    return glasses[id];
  }
  return glasses["aviator"];
}
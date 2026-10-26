"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

type Props = {
  url: string;
  color: string | null; // null = keep the original colours from the .glb
  recolor: string[]; // material names that change colour
  lens?: string[]; // material names to make see-through
  hide?: string[]; // material names to hide completely
  turn?: number; // turn the model around its vertical axis (radians)
};

const NONE: string[] = [];

function Model({ url, color, recolor, lens = NONE, hide = NONE, turn = 0 }: Props) {
  const { scene } = useGLTF(url);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      const copy = (m: THREE.Material) => {
        const mat = m.clone() as THREE.MeshStandardMaterial;
        mat.userData.origColor = mat.color?.clone();
        mat.userData.origMap = mat.map;
        if (hide.includes(mat.name)) mat.visible = false;
        if (lens.includes(mat.name) && !mat.transparent) {
          mat.transparent = true;
          mat.opacity = 0.3;
          mat.depthWrite = false;
        }
        return mat;
      };

      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(copy)
        : copy(mesh.material);
    });
    return clone;
  }, [scene, lens, hide]);

  useEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial;
        if (!recolor.includes(mat.name)) return;
        if (color) {
          mat.map = null;
          mat.color.set(color);
        } else {
          mat.map = mat.userData.origMap ?? null;
          if (mat.userData.origColor) mat.color.copy(mat.userData.origColor);
        }
        mat.needsUpdate = true;
      });
    });
  }, [model, color, recolor]);

  return (
    <group rotation={[0, turn, 0]}>
      <primitive object={model} />
    </group>
  );
}

export default function GlassesViewer(props: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 4], fov: 40 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 3, 5]} intensity={1.5} />
      <Suspense fallback={null}>
        <Environment preset="city" />
        <Bounds fit observe margin={1.4}>
          <Center>
            <Model {...props} />
          </Center>
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault enablePan={false} enableZoom={false} />
    </Canvas>
  );
}
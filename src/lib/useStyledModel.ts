"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Glasses } from "@/lib/glasses";

// Loads a glasses model, applies colour / lens / hide settings, and returns it
// sized so the FRONT of the frame is 1 unit wide, centred, with the front at the origin.
export function useStyledModel(product: Glasses, color: string | null) {
  const { scene } = useGLTF(product.model);

  const pivot = useMemo(() => {
    const lens = product.lens ?? [];
    const hide = product.hide ?? [];
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

    const holder = new THREE.Group();
    holder.rotation.y = product.turn ?? 0;
    holder.add(clone);
    const outer = new THREE.Group();
    outer.add(holder);
    outer.updateMatrixWorld(true);

    // measure only the front slab of the glasses, so arms that splay outward don't count
    const all = new THREE.Box3().setFromObject(outer);
    const slabMin = all.max.z - 0.12 * (all.max.z - all.min.z);
    const front = new THREE.Box3();
    const v = new THREE.Vector3();
    outer.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        if (v.z >= slabMin) front.expandByPoint(v);
      }
    });

    const fw = front.max.x - front.min.x;
    const cx = (front.min.x + front.max.x) / 2;
    const cy = (front.min.y + front.max.y) / 2;
    // front of the frame sits slightly in front of the eyes
    holder.position.set(-cx, -cy, -all.max.z + 0.08 * fw);
    outer.scale.setScalar(1 / fw);
    return outer;
  }, [scene, product]);

  useEffect(() => {
    pivot.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial;
        if (!product.recolor.includes(mat.name)) return;
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
  }, [pivot, color, product]);

  return pivot;
}
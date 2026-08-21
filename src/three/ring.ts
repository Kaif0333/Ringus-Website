/**
 * Procedural Ringus ring: a lathed band with rounded cross-section, PVD-black
 * physical material, and a green sensor cluster on the inner (palm-side)
 * surface. Built from code so the site ships no model file.
 */

import * as THREE from 'three';

export type AnchorName = 'sensor' | 'shell' | 'cell';

export interface RingAnchor {
  position: THREE.Vector3;   // ring-local
  normal: THREE.Vector3;     // ring-local, unit length
}

export interface RingParts {
  group: THREE.Group;
  anchors: Record<AnchorName, RingAnchor>;
  dispose(): void;
}

const R_OUTER = 1.0;
const R_INNER = 0.84;
const HALF_H = 0.2;
const FILLET_OUTER = 0.09;
const FILLET_INNER = 0.045;

/** Rounded-rectangle cross-section in (radius, y), traversed as a closed loop. */
function bandProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, steps = 7): void => {
    for (let i = 0; i <= steps; i += 1) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
  };
  const d = Math.PI / 180;
  arc(R_OUTER - FILLET_OUTER, -HALF_H + FILLET_OUTER, FILLET_OUTER, -90 * d, 0);          // bottom-outer
  arc(R_OUTER - FILLET_OUTER, HALF_H - FILLET_OUTER, FILLET_OUTER, 0, 90 * d);            // top-outer
  arc(R_INNER + FILLET_INNER, HALF_H - FILLET_INNER, FILLET_INNER, 90 * d, 180 * d);      // top-inner
  arc(R_INNER + FILLET_INNER, -HALF_H + FILLET_INNER, FILLET_INNER, 180 * d, 270 * d);    // bottom-inner
  pts.push(pts[0]!.clone());                                                               // close
  return pts;
}

function glowTexture(): THREE.Texture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(184,242,107,0.9)');
  grad.addColorStop(0.35, 'rgba(184,242,107,0.35)');
  grad.addColorStop(1, 'rgba(184,242,107,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildRing(): RingParts {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];

  /* band */
  const geometry = new THREE.LatheGeometry(bandProfile(), 160);
  geometry.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x0e1014,
    metalness: 1,
    roughness: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.35,
    reflectivity: 0.9,
  });
  const band = new THREE.Mesh(geometry, material);
  band.name = 'band';
  group.add(band);
  disposables.push(geometry, material);

  /* inner "optical window" — a slightly lighter strip where the sensors sit */
  const windowGeo = new THREE.CylinderGeometry(R_INNER + 0.004, R_INNER + 0.004, 0.16, 48, 1, true, Math.PI * 1.28, Math.PI * 0.44);
  const windowMat = new THREE.MeshPhysicalMaterial({
    color: 0x14181f,
    metalness: 0.2,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.BackSide,
  });
  const win = new THREE.Mesh(windowGeo, windowMat);
  group.add(win);
  disposables.push(windowGeo, windowMat);

  /* sensor pods on the inner surface, facing the ring's centre */
  const podGeo = new THREE.SphereGeometry(0.026, 20, 16);
  const podMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c10,
    emissive: new THREE.Color(0xb8f26b),
    emissiveIntensity: 2.4,
    roughness: 0.35,
    metalness: 0.1,
  });
  disposables.push(podGeo, podMat);

  const podOffsets: Array<[number, number]> = [
    [-0.085, 0.03], [0, -0.045], [0.085, 0.03], [0, 0.06],
  ];
  // Pods sit on the far (-z) inner wall so they face the camera when the ring
  // is tilted toward the viewer.
  podOffsets.forEach(([dx, dy]) => {
    const pod = new THREE.Mesh(podGeo, podMat);
    const angle = -Math.PI / 2 + dx / R_INNER;
    pod.position.set(Math.cos(angle) * (R_INNER - 0.012), dy, Math.sin(angle) * (R_INNER - 0.012));
    group.add(pod);
  });

  /* soft additive glow around the pods */
  const glowTex = glowTexture();
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(0.42, 0.42, 1);
  glow.position.set(0, 0.01, -(R_INNER - 0.05));
  group.add(glow);
  disposables.push(glowTex, glowMat);

  /* anchors for DOM hotspots (ring-local) */
  const anchors: Record<AnchorName, RingAnchor> = {
    sensor: {
      position: new THREE.Vector3(0, 0, -(R_INNER - 0.02)),
      normal: new THREE.Vector3(0, 0, 1),
    },
    shell: {
      position: new THREE.Vector3(R_OUTER * 0.96, HALF_H * 0.25, R_OUTER * 0.28),
      normal: new THREE.Vector3(0.96, 0.1, 0.28).normalize(),
    },
    cell: {
      position: new THREE.Vector3(-R_INNER * 0.71, 0, -R_INNER * 0.71),
      normal: new THREE.Vector3(0.71, 0, 0.71).normalize(),
    },
  };

  return {
    group,
    anchors,
    dispose(): void {
      disposables.forEach((d) => d.dispose());
    },
  };
}

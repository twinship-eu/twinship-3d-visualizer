"use client";

import { useMemo } from "react";
import { MeshBasicNodeMaterial, PlaneGeometry } from "three/webgpu";
import { positionGeometry, vec4 } from "three/tsl";
import { seascapeBackgroundColor } from "../lib/seascape-tsl";

/**
 * Clip-space depth of the full-screen quad: just inside the far plane.
 *
 * The original vertex shader emits `vec4( position, 1.0 )` with z = 0, which in
 * a scene with a ship would draw the sea in front of it. Placing the quad at the
 * back makes it the background: the ship, nearer, wins the depth test. Kept off
 * exactly 1.0 so it also sits in front of the sky, which is drawn at 1.0.
 */
const SEASCAPE_CLIP_DEPTH = 0.99999;

/**
 * The raymarched "Seascape" sea, drawn full-screen behind the scene.
 *
 * The TSL equivalent of the three.js example's `Mesh( PlaneGeometry,
 * ShaderMaterial )`: the vertex stage passes the plane straight through to clip
 * space, and the fragment stage is the transpiled shader.
 */
export function SceneSeascape() {
  const { geometry, material } = useMemo(() => {
    // 2 x 2 in clip space is exactly the viewport. The example sized its plane
    // to the window in pixels, which covered the same screen many times over.
    const quad = new PlaneGeometry(2, 2);

    const seaMaterial = new MeshBasicNodeMaterial();
    seaMaterial.vertexNode = vec4(positionGeometry.xy, SEASCAPE_CLIP_DEPTH, 1.0);
    seaMaterial.fragmentNode = seascapeBackgroundColor();
    // The shader computes its own sky and atmosphere; scene fog would be
    // evaluated against a quad whose world position means nothing.
    seaMaterial.fog = false;

    return { geometry: quad, material: seaMaterial };
  }, []);

  // Positions are already in clip space, so the object-space bounds that
  // frustum culling tests are meaningless.
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

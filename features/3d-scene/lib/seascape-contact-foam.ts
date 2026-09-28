/**
 * Seascape — 11. Foam around the hull
 *
 * Water churns into foam where it meets a hull. To draw that, the sea needs
 * to know, at every point, how close the hull is. That comes from a texture,
 * built the way Bruno Simon draws his car's tracks: a camera looks straight
 * down on the ship and renders into a texture instead of the screen.
 *
 * 1. The footprint: only the hull below the water's mean level, in white on
 *    black — from above, the hull's outline at the waterline.
 * 2. The distance from every point to the hull, from the footprint
 *    (`seascape-distance-field.ts`) — exact, so the foam fades smoothly at any
 *    width. (A blur did this before, and at a few metres wide its taps drifted
 *    apart and the foam's edge came out in steps.)
 * 3. The sea reads it (`sample`) and turns it into foam.
 *
 * The footprint is also what the ship's wake will be drawn from later: stamped
 * every frame into a trail that fades as the ship moves on.
 */
import {
  Discard,
  Fn,
  positionWorld,
  texture,
  uniform,
  vec2,
  vec4,
} from "three/tsl";
import {
  Color,
  DoubleSide,
  HalfFloatType,
  LinearFilter,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  RenderTarget,
  type Node,
  type Object3D,
  type Renderer,
  type Scene,
} from "three/webgpu";
import { createDistanceField } from "./seascape-distance-field";

/** What `sample` reports outside the footprint's area: far past the foam. */
const OUTSIDE_AREA = 1.0e3;

/** Height above the water the footprint camera looks down from, in world units. */
const CAMERA_HEIGHT = 200;

type ContactFoamOptions = {
  /** Side of the square area around the ship the footprint covers, in world units. */
  areaSize: number;
  /** Texels along each side of the footprint: a power of two. */
  resolution: number;
  /** World Y of the water's mean level. */
  levelY: number;
  /** How far from the hull the foam reaches, in world units, to start with. */
  distance: number;
  /**
   * The sea's height above its mean level at a world point, if it is known:
   * the hull is then cut at the water it actually stands in, so the foam
   * follows the waterline up a crest and down a trough. Without it, at the
   * mean level.
   */
  waterHeight?: (position: Node<"vec2">) => Node<"float">;
};

export function createContactFoam({ areaSize, resolution, levelY, distance, waterHeight }: ContactFoamOptions) {
  const uniforms = {
    /** How far from the hull the foam reaches, in world units. */
    distance: uniform(distance),
  };

  const targetOptions = { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter };
  const footprint = new RenderTarget(resolution, resolution, { ...targetOptions, depthBuffer: true });
  // Distance to the hull, in texels: half floats are exact to 2048, and filterable
  const hullDistance = new RenderTarget(resolution, resolution, { ...targetOptions, depthBuffer: false });
  const distanceField = createDistanceField(resolution);

  // Looking straight down, the top of the image towards -Z
  const half = areaSize / 2;
  const camera = new OrthographicCamera(-half, half, half, -half, 1, CAMERA_HEIGHT * 2);
  camera.position.set(0, levelY + CAMERA_HEIGHT, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, levelY, 0);
  camera.updateMatrixWorld();

  // Only what is under the water: white, seen from either side (with the deck
  // gone, the camera looks into the hull at its insides). Cut at the mean
  // level, the foam hid under the hull's flare when a crest climbed it
  const footprintMaterial = new MeshBasicNodeMaterial();
  footprintMaterial.side = DoubleSide;
  footprintMaterial.fragmentNode = Fn(() => {
    const waterline = waterHeight ? waterHeight(positionWorld.xz).add(levelY) : levelY;
    Discard(positionWorld.y.greaterThan(waterline));

    return vec4(1.0);
  })();


  const black = new Color(0x000000);
  const previousClearColor = new Color();

  /**
   * Redraws the footprint and the distance to it: the ship as it is now in
   * `scene`, without `hidden` (the sea itself): a render of the ship and the
   * distance field's passes, about a millisecond at 1024².
   */
  function update(renderer: Renderer, scene: Scene, hidden: Object3D[]) {
    const previous = {
      target: renderer.getRenderTarget(),
      clearAlpha: renderer.getClearAlpha(),
      overrideMaterial: scene.overrideMaterial,
      backgroundNode: scene.backgroundNode,
      fogNode: scene.fogNode,
      visibility: hidden.map((object) => object.visible),
    };
    // (Typed as three's Color4, which it does not export; a Color takes its rgb)
    renderer.getClearColor(previousClearColor as Parameters<Renderer["getClearColor"]>[0]);

    scene.overrideMaterial = footprintMaterial;
    scene.backgroundNode = null;
    scene.fogNode = null;
    hidden.forEach((object) => (object.visible = false));
    renderer.setClearColor(black, 1);

    renderer.setRenderTarget(footprint);
    renderer.clear();
    renderer.render(scene, camera);

    distanceField.run(renderer, footprint, hullDistance);

    renderer.setRenderTarget(previous.target);
    renderer.setClearColor(previousClearColor, previous.clearAlpha);
    scene.overrideMaterial = previous.overrideMaterial;
    scene.backgroundNode = previous.backgroundNode;
    scene.fogNode = previous.fogNode;
    hidden.forEach((object, index) => (object.visible = previous.visibility[index]));
  }

  const distanceTexture = texture(hullDistance.texture);
  const unitsPerTexel = areaSize / resolution;

  /**
   * How far a world point is from the hull, as a share of `distance`: 0 on
   * the hull's outline (and inside it), 1 where the foam ends, more beyond —
   * and far outside the area.
   */
  function sample(position: Node<"vec2">) {
    // World x, z -> the footprint's uv. The camera has -z at the top of its
    // image, and a render target's v runs from the top down, so v follows +z
    const footprintUV = vec2(position.x.div(areaSize).add(0.5), position.y.div(areaSize).add(0.5));
    const inside = footprintUV.x.greaterThan(0.0).and(footprintUV.x.lessThan(1.0)).and(
      footprintUV.y.greaterThan(0.0).and(footprintUV.y.lessThan(1.0))
    );
    const distanceToHull = texture(distanceTexture, footprintUV).r.mul(unitsPerTexel);

    return inside.select(distanceToHull.div(uniforms.distance.max(1e-3)), OUTSIDE_AREA);
  }

  return { update, sample, uniforms, footprint, hullDistance, camera };
}

export type ContactFoam = ReturnType<typeof createContactFoam>;

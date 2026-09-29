import { float, max, smoothstep, texture as textureNode, uniform } from "three/tsl";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  SRGBColorSpace,
  Vector3,
} from "three/webgpu";
import {
  GLASS_FACES,
  GLASS_OPACITY,
  HUD_INTENSITY,
  HUD_TEXTURE_PIXELS_PER_UNIT,
  HUD_WINDOWS,
  NIGHT_GLASS_OPACITY,
  ROOM_FACE_COUNT,
} from "../bridge-config";

/** The glass: a faint tint by day; by night dark, dimming the view as the bridge's night does. */
const GLASS = { day: { color: "#9fc4ff", opacity: GLASS_OPACITY }, night: { color: "#03050a", opacity: NIGHT_GLASS_OPACITY } } as const;
/** Drawn after the ship's own transparent parts: the glass, then the light on it. */
const GLASS_RENDER_ORDER = 29;
const HUD_RENDER_ORDER = 30;
/** How far inside its window the HUD sits, in the room's own units: just off the glass. */
const HUD_OFFSET = 0.0015;

/** A front window carrying the HUD: its canvas, drawn on, and the texture showing it. */
export type BridgeWindow = { canvas: HTMLCanvasElement; texture: CanvasTexture };

export type BridgeGlass = {
  windows: BridgeWindow[];
  /** Shows the bridge — the windows turned to glass, the HUD on the front ones — or the room as the model has it. */
  setShown: (isShown: boolean) => void;
  /** Night dims the view through the glass. */
  setNight: (isNight: boolean) => void;
  dispose: () => void;
};

/**
 * The HUD on the glass: its cards darken the view behind the text, as the
 * design's panels do, and only its bright strokes — the text, the lines — are
 * lit past white, for the bloom to spread into a halo.
 */
function hudMaterial(canvasTexture: CanvasTexture) {
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
  const sample = textureNode(canvasTexture);
  const brightness = max(sample.r, max(sample.g, sample.b));
  const glow = float(1).add(uniform(HUD_INTENSITY - 1).mul(smoothstep(0.45, 0.85, brightness)));
  material.colorNode = sample.rgb.mul(glow);
  material.opacityNode = sample.a;
  material.toneMapped = false;
  return material;
}

/**
 * A HUD for a window: a quad over its glass, a hair inside it, the canvas
 * mapped so it reads the right way from within — looking over the bow (+z),
 * the room's -x is on the right.
 */
function hudOver(room: Mesh, faces: readonly number[]) {
  const index = room.geometry.index;
  const position = room.geometry.attributes.position;
  const corner = new Vector3();
  const low = new Vector3(Infinity, Infinity, Infinity);
  const high = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const face of faces) {
    for (let side = 0; side < 3; side++) {
      corner.fromBufferAttribute(position, index?.getX(face * 3 + side) ?? face * 3 + side);
      low.min(corner);
      high.max(corner);
    }
  }
  const z = (low.z + high.z) / 2 - HUD_OFFSET;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([high.x, low.y, z, low.x, low.y, z, low.x, high.y, z, high.x, high.y, z]), 3)
  );
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  // The window's size in world units sets the canvas's, so the HUD's text keeps its size
  const scale = room.getWorldScale(new Vector3());
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((high.x - low.x) * scale.x * HUD_TEXTURE_PIXELS_PER_UNIT);
  canvas.height = Math.round((high.y - low.y) * scale.y * HUD_TEXTURE_PIXELS_PER_UNIT);
  const canvasTexture = new CanvasTexture(canvas);
  canvasTexture.colorSpace = SRGBColorSpace;
  const mesh = new Mesh(geometry, hudMaterial(canvasTexture));
  mesh.renderOrder = HUD_RENDER_ORDER;
  return { mesh, window: { canvas, texture: canvasTexture } };
}

/**
 * The bridge in the model's control room. Its windows are painted into its
 * texture, on an opaque shell: on the bridge their triangles leave the shell
 * for a mesh of glass one sees through — every window, all round — and the
 * two front windows by the centreline carry the HUD.
 *
 * Null when the room is not the one the windows were found in.
 */
export function buildBridgeGlass(room: Mesh): BridgeGlass | null {
  const index = room.geometry.index;
  if (!index || index.count / 3 !== ROOM_FACE_COUNT) return null;

  const original = Uint32Array.from(index.array as ArrayLike<number>);
  const withoutGlass = Uint32Array.from(original);
  const glassIndex: number[] = [];
  for (const face of GLASS_FACES) {
    for (let side = 0; side < 3; side++) glassIndex.push(original[face * 3 + side]);
    // Out of the shell: collapsed to its first corner
    withoutGlass[face * 3 + 1] = withoutGlass[face * 3];
    withoutGlass[face * 3 + 2] = withoutGlass[face * 3];
  }

  const glassGeometry = new BufferGeometry();
  for (const [name, attribute] of Object.entries(room.geometry.attributes)) glassGeometry.setAttribute(name, attribute);
  glassGeometry.setIndex(glassIndex);
  const glassMaterial = new MeshBasicNodeMaterial({
    color: GLASS.day.color,
    transparent: true,
    opacity: GLASS.day.opacity,
    depthWrite: false,
    side: DoubleSide,
  });
  const glass = new Mesh(glassGeometry, glassMaterial);
  glass.renderOrder = GLASS_RENDER_ORDER;
  glass.visible = false;
  room.add(glass);

  const huds = HUD_WINDOWS.map((faces) => hudOver(room, faces));
  huds.forEach(({ mesh }) => {
    mesh.visible = false;
    room.add(mesh);
  });

  const setIndexFrom = (source: Uint32Array) => {
    for (let item = 0; item < source.length; item++) index.setX(item, source[item]);
    index.needsUpdate = true;
  };

  return {
    windows: huds.map(({ window }) => window),
    setShown(isShown) {
      setIndexFrom(isShown ? withoutGlass : original);
      glass.visible = isShown;
      huds.forEach(({ mesh }) => (mesh.visible = isShown));
    },
    setNight(isNight) {
      const tint = isNight ? GLASS.night : GLASS.day;
      glassMaterial.color.set(tint.color);
      glassMaterial.opacity = tint.opacity;
    },
    dispose() {
      setIndexFrom(original);
      glass.removeFromParent();
      glassGeometry.dispose();
      glassMaterial.dispose();
      huds.forEach(({ mesh, window }) => {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        (mesh.material as MeshBasicNodeMaterial).dispose();
        window.texture.dispose();
      });
    },
  };
}

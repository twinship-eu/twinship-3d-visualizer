import { float, max, smoothstep, texture as textureNode, uniform } from "three/tsl";
import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type Object3D,
} from "three/webgpu";
import {
  EYE_IN_ROOM,
  GLASS_OPACITY,
  HUD_INTENSITY,
  NIGHT_GLASS_OPACITY,
  PANE_COUNT,
  PANE_HEIGHT_SHARE,
  PANE_INSET,
  PANE_MULLION_WIDTH,
  PANE_TEXTURE_HEIGHT,
} from "../bridge-config";

/** The colours of the bridge's frames and walls, by day and by night. */
const FRAME_COLORS = { day: "#23489a", night: "#15171d" } as const;
/** The glass: a faint tint by day; by night dark, dimming the view as the bridge's night does. */
const GLASS = { day: { color: "#9fc4ff", opacity: GLASS_OPACITY }, night: { color: "#03050a", opacity: NIGHT_GLASS_OPACITY } } as const;
/** Drawn after the ship's own transparent parts: the glass, then the light on it. */
const GLASS_RENDER_ORDER = 29;
const HUD_RENDER_ORDER = 30;

/** A pane of the front windows: its canvas, drawn on for the HUD, and the texture that shows it. */
export type BridgePane = { canvas: HTMLCanvasElement; texture: CanvasTexture };

export type BridgeGlass = {
  /** Where the eye stands, in the rig's space: the camera is put there every frame. */
  eye: Vector3;
  rig: Group;
  /**
   * Shows the bridge, or the room as the model has it: its windows are painted
   * into its opaque, double-sided shell, so from inside the shell is hidden —
   * its materials, not the object, which carries the glass — and the rig's
   * frames stand in for it.
   */
  setShown: (isShown: boolean) => void;
  panes: BridgePane[];
  /** Night darkens the frames, and the view through the glass. */
  setNight: (isNight: boolean) => void;
  dispose: () => void;
};

/** A box's eight corners, taken into an object's own space: its bounding box there. */
function localBoxOf(object: Object3D) {
  const world = new Box3().setFromObject(object);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((corner) =>
    object.worldToLocal(
      new Vector3(
        corner & 1 ? world.max.x : world.min.x,
        corner & 2 ? world.max.y : world.min.y,
        corner & 4 ? world.max.z : world.min.z
      )
    )
  );
  return new Box3().setFromPoints(corners);
}

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
 * The bridge's glass in the model's control room: five panes across its
 * front windows, each carrying a HUD canvas, with frames between them and
 * the room's walls and roof round the eye — so, looking about, one stays in
 * the room. Built in world units on a rig the room carries: it rides the ship.
 */
export function buildBridgeGlass(room: Object3D): BridgeGlass {
  room.updateWorldMatrix(true, true);
  const scale = room.getWorldScale(new Vector3());
  const local = localBoxOf(room);
  // The room's box in world units, from its origin
  const box = new Box3(local.min.clone().multiply(scale), local.max.clone().multiply(scale));
  const size = box.getSize(new Vector3());

  const rig = new Group();
  rig.name = "BridgeGlass";
  rig.scale.set(1 / scale.x, 1 / scale.y, 1 / scale.z);
  room.add(rig);

  const eye = new Vector3(
    box.min.x + size.x * EYE_IN_ROOM.x,
    box.min.y + size.y * EYE_IN_ROOM.y,
    box.min.z + size.z * EYE_IN_ROOM.z
  );

  const frameMaterial = new MeshBasicNodeMaterial({ color: FRAME_COLORS.day });
  const glassMaterial = new MeshBasicNodeMaterial({ color: GLASS.day.color, transparent: true, opacity: GLASS.day.opacity, depthWrite: false, side: DoubleSide });
  const geometries: (BoxGeometry | PlaneGeometry)[] = [];
  const addBox = (width: number, height: number, depth: number, x: number, y: number, z: number) => {
    const geometry = new BoxGeometry(width, height, depth);
    geometries.push(geometry);
    const mesh = new Mesh(geometry, frameMaterial);
    mesh.position.set(x, y, z);
    rig.add(mesh);
  };

  // The front windows: glass from sill to head, across the room less its sides
  const glassZ = box.max.z - PANE_INSET.front;
  const left = box.min.x + PANE_INSET.side;
  const right = box.max.x - PANE_INSET.side;
  const bottom = box.min.y + size.y * PANE_HEIGHT_SHARE.from;
  const top = box.min.y + size.y * PANE_HEIGHT_SHARE.to;
  const paneWidth = (right - left - (PANE_COUNT - 1) * PANE_MULLION_WIDTH) / PANE_COUNT;
  const paneHeight = top - bottom;
  const textureWidth = Math.round((PANE_TEXTURE_HEIGHT * paneWidth) / paneHeight);

  const panes: BridgePane[] = [];
  const hudMaterials: MeshBasicNodeMaterial[] = [];
  for (let index = 0; index < PANE_COUNT; index++) {
    // Left to right as seen from the eye, looking over the bow (+z): the ship's +x is on the left
    const centreX = right - paneWidth / 2 - index * (paneWidth + PANE_MULLION_WIDTH);
    const centreY = (bottom + top) / 2;
    const plane = new PlaneGeometry(paneWidth, paneHeight);
    geometries.push(plane);

    const glass = new Mesh(plane, glassMaterial);
    glass.position.set(centreX, centreY, glassZ + 0.01);
    glass.renderOrder = GLASS_RENDER_ORDER;
    rig.add(glass);

    const canvas = document.createElement("canvas");
    canvas.width = textureWidth;
    canvas.height = PANE_TEXTURE_HEIGHT;
    const canvasTexture = new CanvasTexture(canvas);
    canvasTexture.colorSpace = SRGBColorSpace;
    const material = hudMaterial(canvasTexture);
    hudMaterials.push(material);
    const hud = new Mesh(plane, material);
    // Facing the eye: turned round, so the text reads the right way from inside
    hud.rotation.y = Math.PI;
    hud.position.set(centreX, centreY, glassZ);
    hud.renderOrder = HUD_RENDER_ORDER;
    rig.add(hud);
    panes.push({ canvas, texture: canvasTexture });

    if (index > 0) addBox(PANE_MULLION_WIDTH, paneHeight, 0.08, centreX + paneWidth / 2 + PANE_MULLION_WIDTH / 2, centreY, glassZ);
  }
  // Sill and head across the front; the room's sides, back and roof round the eye
  addBox(size.x, bottom - box.min.y, 0.1, (box.min.x + box.max.x) / 2, (box.min.y + bottom) / 2, glassZ);
  addBox(size.x, box.max.y - top, 0.1, (box.min.x + box.max.x) / 2, (top + box.max.y) / 2, glassZ);
  addBox(0.1, size.y, size.z, box.min.x, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
  addBox(0.1, size.y, size.z, box.max.x, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
  addBox(size.x, size.y, 0.1, (box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z);
  addBox(size.x, 0.08, size.z, (box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);

  // The room's own meshes: their materials hidden while on the bridge
  const shellMaterials: { visible: boolean }[] = [];
  room.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || child.parent === rig || child === rig) return;
    if (rig.getObjectById(child.id)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    shellMaterials.push(...materials);
  });

  return {
    eye,
    rig,
    setShown(isShown) {
      rig.visible = isShown;
      shellMaterials.forEach((material) => (material.visible = !isShown));
    },
    panes,
    setNight(isNight) {
      frameMaterial.color.set(isNight ? FRAME_COLORS.night : FRAME_COLORS.day);
      const glass = isNight ? GLASS.night : GLASS.day;
      glassMaterial.color.set(glass.color);
      glassMaterial.opacity = glass.opacity;
    },
    dispose() {
      shellMaterials.forEach((material) => (material.visible = true));
      rig.removeFromParent();
      geometries.forEach((geometry) => geometry.dispose());
      panes.forEach((pane) => pane.texture.dispose());
      [frameMaterial, glassMaterial, ...hudMaterials].forEach((material) => material.dispose());
    },
  };
}

import { cos, float, positionLocal, sin, transformNormalToView, uniform, vec3 } from "three/tsl";
import {
  Box3,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type Object3D,
} from "three/webgpu";

/**
 * The flag at the bow. The model has a small pennant there, baked into the
 * hull's deck mesh: its triangles are hidden, and the EU flag flies from the
 * same staff instead, a cloth waving in the wind the ship feels.
 */

/** The hull's deck mesh, holding the staff and the pennant. */
const FLAG_MESH_NAME = "Base_4";
/** The modelled pennant's and the staff's triangles in it, as [first, last + 1). */
const PENNANT_FACES = [2448, 2456] as const;
const STAFF_FACES = [2342, 2448] as const;
/** The mesh's triangle count they were found in: a different export, and they are left alone. */
const FLAG_MESH_FACE_COUNT = 2456;

/** The flag's size, in world units (a unit is about 2 m): 2:3, the EU flag's proportions. */
const HOIST = 0.9;
const FLY = HOIST * 1.5;
/** Cloth cells: enough for a wave to read as a curve. */
const FLY_SEGMENTS = 24;
const HOIST_SEGMENTS = 8;

/** The EU flag's colours, as its graphic specification gives them. */
const EU_BLUE = "#003399";
const EU_YELLOW = "#FFCC00";
/** Its texture's size, in pixels: 3:2. */
const TEXTURE_WIDTH = 768;
const TEXTURE_HEIGHT = 512;

/**
 * How the cloth moves with the apparent wind, in m/s: the waves' reach at
 * the fly end, as a share of the fly — slack in a breeze, taut and rippling
 * in a gale — and how fast they run down it.
 */
const WAVE = {
  /** Wind at which the flag flies fully out. */
  fullWindMs: 14,
  amplitudeCalm: 0.14,
  amplitudeFull: 0.1,
  /** A shorter ripple over the long waves, as a share of theirs: the cloth's flutter. */
  flutterShare: 0.35,
  flutterWaves: 3.7,
  /** Waves along the fly, and their speed: rad/s at no wind, and more per m/s. */
  wavesAlongFly: 1.6,
  speedCalm: 2.2,
  speedPerMs: 0.45,
  /** How far the fly end droops at no wind, as a share of the fly. */
  droopCalm: 0.55,
} as const;
/** How quickly the flag turns to the wind, in seconds (the time constant). */
const TURN_TIME_S = 1.5;

/** Draws the flag of the European Union: twelve gold stars in a circle on blue, as specified. */
function drawEuFlag() {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("EU flag: no 2D canvas context to draw it");

  context.fillStyle = EU_BLUE;
  context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  // The stars' circle has a third of the hoist for radius; each star, a
  // circle of an eighteenth; one points up, and they stand upright
  const circleRadius = TEXTURE_HEIGHT / 3;
  const starRadius = TEXTURE_HEIGHT / 18;
  const centre = { x: TEXTURE_WIDTH / 2, y: TEXTURE_HEIGHT / 2 };
  context.fillStyle = EU_YELLOW;
  for (let star = 0; star < 12; star++) {
    const angle = (star / 12) * Math.PI * 2;
    const x = centre.x + circleRadius * Math.sin(angle);
    const y = centre.y - circleRadius * Math.cos(angle);
    context.beginPath();
    for (let point = 0; point < 10; point++) {
      const radius = point % 2 === 0 ? starRadius : starRadius * 0.382;
      const pointAngle = (point / 10) * Math.PI * 2;
      context.lineTo(x + radius * Math.sin(pointAngle), y - radius * Math.cos(pointAngle));
    }
    context.closePath();
    context.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * The flag's cloth: a plane from the staff (x = 0) out along +x, its top at
 * y = 0, rippled in the vertex shader. `wind` sets how it flies (0 calm, 1
 * full); `time` runs the waves.
 */
function createFlagCloth() {
  const geometry = new PlaneGeometry(FLY, HOIST, FLY_SEGMENTS, HOIST_SEGMENTS);
  geometry.translate(FLY / 2, -HOIST / 2, 0);

  const time = uniform(0);
  const wind = uniform(0);
  const material = new MeshStandardNodeMaterial({ map: drawEuFlag(), side: DoubleSide, roughness: 0.85, metalness: 0 });

  // Along the fly, 0 at the staff; the waves grow out to the free end
  const along = positionLocal.x.div(FLY);
  const amplitude = float(WAVE.amplitudeCalm).mix(float(WAVE.amplitudeFull), wind).mul(FLY);
  const speed = float(WAVE.speedCalm).add(wind.mul(WAVE.speedPerMs * WAVE.fullWindMs));
  const phase = along.mul(WAVE.wavesAlongFly * Math.PI * 2).sub(time.mul(speed)).add(positionLocal.y.mul(1.3));
  const reach = along.pow(1.3);
  const flutterPhase = along.mul(WAVE.flutterWaves * Math.PI * 2).sub(time.mul(speed).mul(1.7)).add(positionLocal.y.mul(2.1));
  const ripple = sin(phase).add(sin(flutterPhase).mul(WAVE.flutterShare)).mul(amplitude).mul(reach);
  // A slack flag hangs: its free end drops as the wind falls
  const droop = along.mul(along).mul(float(1).sub(wind)).mul(WAVE.droopCalm * FLY);
  material.positionNode = vec3(positionLocal.x, positionLocal.y.sub(droop), positionLocal.z.add(ripple));
  // The ripple's slope along the fly, for the light to catch the folds
  const slope = cos(phase)
    .mul(WAVE.wavesAlongFly)
    .add(cos(flutterPhase).mul(WAVE.flutterShare * WAVE.flutterWaves))
    .mul(amplitude)
    .mul(reach)
    .mul(Math.PI * 2)
    .div(FLY);
  material.normalNode = transformNormalToView(vec3(slope.negate(), 0, 1).normalize());

  const cloth = new Mesh(geometry, material);
  cloth.castShadow = true;
  return { cloth, time, wind };
}

/** A range of a mesh's triangles, collapsed to nothing: hidden, the rest of the mesh drawn as it was. */
function collapseFaces(mesh: Mesh, [first, end]: readonly [number, number]) {
  const index = mesh.geometry.index;
  if (!index) return;
  // The index holds a corner an item: each triangle's three set to its first
  for (let face = first; face < end; face++) {
    const corner = index.getX(face * 3);
    index.setX(face * 3 + 1, corner);
    index.setX(face * 3 + 2, corner);
  }
  index.needsUpdate = true;
}

/** The staff's top, in the deck mesh's own space. */
function staffTopOf(mesh: Mesh) {
  const index = mesh.geometry.index;
  const position = mesh.geometry.attributes.position;
  const box = new Box3();
  const corner = new Vector3();
  if (!index) return null;
  for (let face = STAFF_FACES[0]; face < STAFF_FACES[1]; face++) {
    for (let side = 0; side < 3; side++) box.expandByPoint(corner.fromBufferAttribute(position, index.getX(face * 3 + side)));
  }
  return box.isEmpty() ? null : new Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
}

export type ShipFlag = {
  /** Brings the cloth to this moment, flying away from the apparent wind (m/s, scene x and z). */
  update: (elapsedSeconds: number, delta: number, apparentWind: { x: number; z: number }) => void;
  dispose: () => void;
};

/**
 * Hides the model's pennant and hoists the EU flag on its staff, in the ship
 * model `root`. Null, and nothing changed, when the model is not the one the
 * pennant was found in.
 */
export function hoistEuFlag(root: Object3D): ShipFlag | null {
  const deck = root.getObjectByName(FLAG_MESH_NAME);
  if (!(deck instanceof Mesh) || !deck.geometry.index || deck.geometry.index.count / 3 !== FLAG_MESH_FACE_COUNT) {
    return null;
  }
  const staffTop = staffTopOf(deck);
  if (!staffTop) return null;
  collapseFaces(deck, PENNANT_FACES);

  // On the staff, in world units: the deck mesh is scaled from its quantised export
  const { cloth, time, wind } = createFlagCloth();
  const halyard = new Group();
  halyard.position.copy(staffTop);
  deck.updateWorldMatrix(true, false);
  const scale = deck.getWorldScale(new Vector3());
  halyard.scale.set(1 / scale.x, 1 / scale.y, 1 / scale.z);
  halyard.add(cloth);
  deck.add(halyard);

  let heading: number | null = null;
  return {
    update(elapsedSeconds, delta, apparentWind) {
      const speed = Math.hypot(apparentWind.x, apparentWind.z);
      time.value = elapsedSeconds;
      wind.value = Math.min(speed / WAVE.fullWindMs, 1);
      if (speed < 0.1) return;
      // The fly (+x) downwind: a turn about y takes +x to (cos, -sin)
      const target = Math.atan2(-apparentWind.z, apparentWind.x);
      heading ??= target;
      const turn = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
      heading += turn * (1 - Math.exp(-delta / TURN_TIME_S));
      halyard.rotation.y = heading;
    },
    dispose() {
      halyard.removeFromParent();
      cloth.geometry.dispose();
      const material = cloth.material as MeshStandardNodeMaterial;
      material.map?.dispose();
      material.dispose();
    },
  };
}

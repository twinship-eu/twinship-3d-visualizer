/**
 * Seascape — 15. Buoys
 *
 * A buoyed channel around the ship's track: two rows of lateral marks, red to
 * port and green to starboard (IALA region A), riding the waves, a yellow
 * lamp flashing on each. Under way they fall behind at the ship's speed —
 * whichever way the waves run, they are what shows the ship moving.
 *
 * The sea is endless: the ship stays at the origin and the sea flows past it
 * (`seaOffset`). Each buoy is moored at a fixed point of the sea, repeating
 * every CHANNEL_LENGTH along the track: once it has fallen that far behind,
 * it is the next buoy of its row, far ahead in the haze.
 *
 * One mesh, drawn BUOY_COUNT times (`mesh.count`): every part of a buoy merged
 * into a single geometry, with a `buoyPart` attribute saying which part each
 * vertex belongs to; each buoy's place and tilt in an `instancedArray`, read by
 * `instanceIndex` in the vertex shader. One draw call for the whole channel.
 */
import {
  attribute,
  color,
  cos,
  float,
  instancedArray,
  instanceIndex,
  mix,
  positionLocal,
  sin,
  time,
  vec3,
} from "three/tsl";
import {
  BufferAttribute,
  ConeGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardNodeMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Node,
} from "three/webgpu";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ProbePoint } from "./seascape-wave-probes";

// The channel
/** How far each row lies from the ship's track, in world units. */
const CHANNEL_HALF_WIDTH = 60;
/** Distance between buoys along a row, in world units: at 100 there were too many. */
const BUOY_SPACING = 300;
/**
 * Buoys per row: the channel repeats every BUOY_SPACING · this along the
 * track — 1500, so a buoy wraps round out in the haze (complete at 1550).
 */
const BUOYS_PER_ROW = 5;
const CHANNEL_LENGTH = BUOY_SPACING * BUOYS_PER_ROW;
/** The starboard row is set half a spacing on from the port one, as channels are buoyed. */
const STARBOARD_STAGGER = BUOY_SPACING / 2;
/** Buoys: port ones at even indices, starboard at odd. */
const BUOY_COUNT = BUOYS_PER_ROW * 2;

/** Points probed around each buoy for its heave and tilt: its centre, and this far to +x and +z. */
const TILT_PROBE_SPREAD = 1.5;
/** How high the buoy's origin sits above the water, in world units. */
const FREEBOARD = 0.2;
/** How much of the water's tilt the buoy takes: a float follows the slope, not quite all of it. */
const TILT_FOLLOWING = 0.8;
/** How quickly it follows the water, per second (the time constant's inverse): buoys bob lively. */
const FOLLOW_RATE = 6;

// The lamps
/** Seconds between flashes, and how long each lasts. */
const FLASH_PERIOD = 4;
const FLASH_LENGTH = 0.6;
/**
 * The lamp's emissive strength at the height of a flash: its colour × 50, far
 * past white, which is what the bloom catches (see `scene-render-pipeline.tsx`).
 */
const FLASH_BRIGHTNESS = 50;
/** Its glow between flashes. */
const LAMP_IDLE = 3;

// The parts, as `buoyPart` numbers them
const BODY_PART = 0;
const FITTINGS_PART = 1;
const LAMP_PART = 2;

const PORT_RED = "#c8261e";
const STARBOARD_GREEN = "#1f8a3c";
const FITTINGS_DARK = "#2b2b2b";
/** The lamps' light: a warm yellow, not a pure one. */
const LAMP_YELLOW = "#ffc94a";

/** A buoy's parts merged into one geometry, each vertex marked with its part. */
function createBuoyGeometry() {
  const placed = (geometry: BufferGeometry, part: number, x: number, y: number, z: number, rotationX = 0, rotationZ = 0) => {
    const holder = new Object3D();
    holder.position.set(x, y, z);
    holder.rotation.set(rotationX, 0, rotationZ);
    holder.updateMatrix();
    const piece = geometry.applyMatrix4(holder.matrix).toNonIndexed();
    const count = piece.getAttribute("position").count;
    piece.setAttribute("buoyPart", new BufferAttribute(new Float32Array(count).fill(part), 1));

    return piece;
  };

  const pieces = [placed(new CylinderGeometry(1.3, 1.1, 1.8, 20), BODY_PART, 0, 0.2, 0)];
  // Lattice tower: four legs leaning in, and two rings
  for (let leg = 0; leg < 4; leg++) {
    const angle = (leg / 4) * Math.PI * 2 + Math.PI / 4;
    pieces.push(
      placed(
        new CylinderGeometry(0.06, 0.08, 3.2, 6),
        BODY_PART,
        Math.cos(angle) * 0.55,
        2.7,
        Math.sin(angle) * 0.55,
        Math.sin(angle) * 0.12,
        -Math.cos(angle) * 0.12
      )
    );
  }
  pieces.push(
    placed(new TorusGeometry(0.66, 0.05, 6, 16), BODY_PART, 0, 2.0, 0, Math.PI / 2),
    placed(new TorusGeometry(0.45, 0.05, 6, 16), BODY_PART, 0, 3.5, 0, Math.PI / 2),
    placed(new ConeGeometry(1.1, 1.0, 20), FITTINGS_PART, 0, -1.2, 0, Math.PI),
    placed(new TorusGeometry(1.32, 0.12, 8, 20), FITTINGS_PART, 0, 1.1, 0, Math.PI / 2),
    // Top mark: a can, as lateral marks carry, and the lamp above it
    placed(new CylinderGeometry(0.3, 0.3, 0.55, 12), FITTINGS_PART, 0, 4.55, 0),
    placed(new SphereGeometry(0.3, 12, 8), LAMP_PART, 0, 5.2, 0)
  );

  const merged = mergeGeometries(pieces);
  if (!merged) throw new Error("Could not merge the buoy's parts");

  return merged;
}

/** Turns a point about x, then z: a buoy's tilt, as the CPU works it out. */
function tilted(point: Node<"vec3">, tiltX: Node<"float">, tiltZ: Node<"float">) {
  const aboutZ = vec3(
    point.x.mul(cos(tiltZ)).sub(point.y.mul(sin(tiltZ))),
    point.x.mul(sin(tiltZ)).add(point.y.mul(cos(tiltZ))),
    point.z
  );

  return vec3(
    aboutZ.x,
    aboutZ.y.mul(cos(tiltX)).sub(aboutZ.z.mul(sin(tiltX))),
    aboutZ.y.mul(sin(tiltX)).add(aboutZ.z.mul(cos(tiltX)))
  );
}

export function createBuoys(levelY: number) {
  // Each buoy: where it is (xyz, in a vec4 — WGSL pads a vec3 to four floats,
  // and written with a stride of three the buoys piled up at the origin), and
  // its tilt about x and z
  const places = instancedArray(BUOY_COUNT, "vec4");
  const tilts = instancedArray(BUOY_COUNT, "vec2");
  const placesArray = places.value.array as Float32Array;
  const tiltsArray = tilts.value.array as Float32Array;

  const part = attribute<"float">("buoyPart", "float");
  const isStarboard = instanceIndex.toFloat().mod(2.0);
  const isFittings = part.equal(FITTINGS_PART);
  const isLamp = part.equal(LAMP_PART);

  const material = new MeshStandardNodeMaterial({ roughness: 0.55, metalness: 0.1 });
  const tilt = tilts.element(instanceIndex);
  material.positionNode = tilted(positionLocal, tilt.x, tilt.y).add(places.element(instanceIndex).xyz);

  // Body in its side's colour, fittings dark, lamp yellow
  const sideColor = mix(color(PORT_RED), color(STARBOARD_GREEN), isStarboard);
  material.colorNode = isLamp.select(
    vec3(color(LAMP_YELLOW)),
    isFittings.select(vec3(color(FITTINGS_DARK)), vec3(sideColor))
  );

  // The lamp flashes a short pulse every FLASH_PERIOD, each buoy at its own
  // moment; emissive, so it shines whatever light falls on it
  const phase = time.add(instanceIndex.toFloat().mul(0.61)).mod(FLASH_PERIOD);
  const flash = phase.lessThan(FLASH_LENGTH).select(sin(phase.div(FLASH_LENGTH).mul(Math.PI)), float(0.0));
  material.emissiveNode = vec3(color(LAMP_YELLOW)).mul(
    isLamp.select(mix(float(LAMP_IDLE), float(FLASH_BRIGHTNESS), flash), float(0.0))
  );

  const mesh = new Mesh(createBuoyGeometry(), material);
  mesh.count = BUOY_COUNT;
  // Drawn where the instances are, not where the geometry is: never culled
  mesh.frustumCulled = false;
  mesh.castShadow = true;

  /** Where each buoy is now, in the ship's frame, the sea having flowed `sailed` past. */
  function placements(sailed: number) {
    return Array.from({ length: BUOY_COUNT }, (_, buoy) => {
      const starboard = buoy % 2 === 1;
      const along = Math.floor(buoy / 2) * BUOY_SPACING + (starboard ? STARBOARD_STAGGER : 0);
      const half = CHANNEL_LENGTH / 2;
      const z = ((((along - sailed + half) % CHANNEL_LENGTH) + CHANNEL_LENGTH) % CHANNEL_LENGTH) - half;

      return { x: starboard ? CHANNEL_HALF_WIDTH : -CHANNEL_HALF_WIDTH, z };
    });
  }

  /** The points to probe the sea at, for `sailed`: three per buoy. */
  function probePoints(sailed: number): ProbePoint[] {
    return placements(sailed).flatMap(({ x, z }) => [
      { x, z },
      { x: x + TILT_PROBE_SPREAD, z },
      { x, z: z + TILT_PROBE_SPREAD },
    ]);
  }

  const heave = new Float32Array(BUOY_COUNT);
  const tiltX = new Float32Array(BUOY_COUNT);
  const tiltZ = new Float32Array(BUOY_COUNT);
  const lastZ = new Float32Array(BUOY_COUNT).fill(Number.NaN);

  /**
   * Moves the buoys: along with the sea, and up and down with the heights
   * probed at `probePoints` (null when the sea is not probed: they rest level).
   */
  function update(sailed: number, heights: ArrayLike<number> | null, elapsed: number) {
    const follow = 1 - Math.exp(-FOLLOW_RATE * elapsed);
    placements(sailed).forEach(({ x, z }, buoy) => {
      // A buoy that has just wrapped round starts afresh, not easing in from where it was
      const wrapped = Number.isNaN(lastZ[buoy]) || Math.abs(z - lastZ[buoy]) > CHANNEL_LENGTH / 2;
      lastZ[buoy] = z;
      const here = heights?.[buoy * 3] ?? 0;
      const alongX = heights?.[buoy * 3 + 1] ?? 0;
      const alongZ = heights?.[buoy * 3 + 2] ?? 0;
      const ease = wrapped ? 1 : follow;

      heave[buoy] += (here - heave[buoy]) * ease;
      tiltZ[buoy] += (Math.atan((alongX - here) / TILT_PROBE_SPREAD) * TILT_FOLLOWING - tiltZ[buoy]) * ease;
      tiltX[buoy] += (-Math.atan((alongZ - here) / TILT_PROBE_SPREAD) * TILT_FOLLOWING - tiltX[buoy]) * ease;

      placesArray.set([x, levelY + heave[buoy] + FREEBOARD, z, 0], buoy * 4);
      tiltsArray.set([tiltX[buoy], tiltZ[buoy]], buoy * 2);
    });
    places.value.needsUpdate = true;
    tilts.value.needsUpdate = true;
  }

  return { mesh, probePoints, update };
}

export type Buoys = ReturnType<typeof createBuoys>;

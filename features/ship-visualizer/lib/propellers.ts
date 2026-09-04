import { BufferGeometry, Group, Mesh, Object3D, Vector2 } from "three";

/**
 * The model exports both screws as a single mesh, so nothing in the scene graph
 * can be spun on its own. These helpers split that mesh into one group per
 * screw, pivoted on its own shaft axis, so each can rotate independently.
 *
 * The split is purely topological: vertex data is never rewritten, only the
 * triangle index is partitioned and the pivot is expressed as a pair of
 * cancelling group/mesh translations.
 */

/** The screws sit either side of the hull centreline, which is the model's x = 0. */
const CENTRELINE_X = 0;

/** Marks nodes this module injects, so the component tree can ignore them. */
export const INTERNAL_NODE_FLAG = "isVisualizerInternal";

/**
 * Locates the shaft axis of one screw in the XY plane.
 *
 * A screw is a rotationally symmetric body: identical blades repeated at even
 * angular spacing around a shaft. The vertex centroid of such a point set lies
 * on the axis of symmetry, because every blade contributes the same vertices
 * merely rotated. Measured against a circle fit through the bare shaft, this
 * lands within 1% of the swept radius.
 *
 * Bounding-box centres do NOT work here and were the source of a visible
 * wobble: blade tips do not reach the box extremes evenly, which threw the
 * centre off by ~5% of the swept radius.
 */
function findShaftAxis(geometry: BufferGeometry, vertices: number[]): Vector2 {
  const position = geometry.getAttribute("position");
  const centroid = new Vector2();
  for (const v of vertices) {
    centroid.x += position.getX(v);
    centroid.y += position.getY(v);
  }
  return centroid.divideScalar(vertices.length);
}

/** Builds a geometry drawing only the given triangles of the source geometry. */
function geometryForTriangles(source: BufferGeometry, indices: number[]): BufferGeometry {
  const geometry = source.clone();
  // clone() copies the source's draw groups, whose ranges refer to the old
  // index; leaving them in place would draw past the end of the new one.
  geometry.clearGroups();
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Replaces the combined propeller mesh with a group holding one pivoted child
 * per screw, and returns those children ordered by their position across the
 * hull (negative x first). Returns an empty array if the model has no such
 * mesh, which leaves the scene untouched.
 */
export function splitPropellersIntoSpinners(
  root: Object3D,
  objectName: string
): Group[] {
  const source = root.getObjectByName(objectName);
  if (!source || !(source as Mesh).isMesh) return [];

  const mesh = source as Mesh;
  const parent = mesh.parent;
  if (!parent) return [];

  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const index = geometry.index;
  const triangleCount = index ? index.count / 3 : position.count / 3;

  const sides: { triangles: number[]; vertices: Set<number> }[] = [
    { triangles: [], vertices: new Set() },
    { triangles: [], vertices: new Set() },
  ];

  for (let t = 0; t < triangleCount; t++) {
    const corners = [0, 1, 2].map((c) =>
      index ? index.getX(t * 3 + c) : t * 3 + c
    );
    const centroidX =
      corners.reduce((sum, v) => sum + position.getX(v), 0) / corners.length;
    const side = sides[centroidX < CENTRELINE_X ? 0 : 1];
    side.triangles.push(...corners);
    corners.forEach((v) => side.vertices.add(v));
  }

  if (sides.some((side) => side.triangles.length === 0)) return [];

  const container = new Group();
  container.name = mesh.name;
  container.position.copy(mesh.position);
  container.quaternion.copy(mesh.quaternion);
  container.scale.copy(mesh.scale);

  const spinners = sides.map((side, i) => {
    const sideGeometry = geometryForTriangles(geometry, side.triangles);
    const axis = findShaftAxis(geometry, [...side.vertices]);

    const spinner = new Group();
    spinner.name = `${mesh.name}_Shaft_${i}`;
    spinner.userData[INTERNAL_NODE_FLAG] = true;
    spinner.position.set(axis.x, axis.y, 0);

    const screw = new Mesh(sideGeometry, mesh.material);
    screw.name = `${mesh.name}_Screw_${i}`;
    screw.castShadow = true;
    screw.receiveShadow = true;
    // Cancels the spinner's offset, so the screw stays put but now turns about
    // its own shaft rather than the mesh origin.
    screw.position.set(-axis.x, -axis.y, 0);

    spinner.add(screw);
    container.add(spinner);
    return spinner;
  });

  parent.remove(mesh);
  parent.add(container);

  return spinners;
}

import { Mesh, Object3D, Triangle, Vector3 } from "three";

/**
 * A triangle's world-space corners plus the running area total up to and
 * including it, so a sample can be drawn in proportion to area.
 */
type WeightedTriangle = {
  a: Vector3;
  b: Vector3;
  c: Vector3;
  cumulativeArea: number;
};

const triangle = new Triangle();

function collectWeightedTriangles(root: Object3D): {
  triangles: WeightedTriangle[];
  totalArea: number;
} {
  // World matrices must be current: this runs right after the model is built,
  // possibly before the first render, so nothing else has computed them yet.
  root.updateWorldMatrix(true, true);

  const triangles: WeightedTriangle[] = [];
  let totalArea = 0;

  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const position = mesh.geometry.getAttribute("position");
    if (!position) return;

    const index = mesh.geometry.index;
    const triangleCount = index ? index.count / 3 : position.count / 3;

    for (let t = 0; t < triangleCount; t++) {
      const corners = [0, 1, 2].map((corner) => {
        const vertex = index ? index.getX(t * 3 + corner) : t * 3 + corner;
        return new Vector3(
          position.getX(vertex),
          position.getY(vertex),
          position.getZ(vertex)
        ).applyMatrix4(mesh.matrixWorld);
      });

      triangle.set(corners[0], corners[1], corners[2]);
      totalArea += triangle.getArea();
      triangles.push({
        a: corners[0],
        b: corners[1],
        c: corners[2],
        cumulativeArea: totalArea,
      });
    }
  });

  return { triangles, totalArea };
}

/** Index of the first triangle whose cumulative area exceeds `target`. */
function findTriangleAt(
  triangles: WeightedTriangle[],
  target: number
): WeightedTriangle {
  let low = 0;
  let high = triangles.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (triangles[mid].cumulativeArea < target) low = mid + 1;
    else high = mid;
  }
  return triangles[low];
}

/**
 * Samples `count` points spread evenly across a model's surface, in world space.
 *
 * Area-weighted rather than picking random vertices: vertex density follows
 * modelling detail, so vertex sampling would crowd the railings, cranes and
 * other fiddly parts while leaving the hull — most of the ship's actual
 * silhouette — nearly bare.
 *
 * Returns a flat xyz array ready to upload as an instanced attribute, or `null`
 * if the model has no triangles to sample.
 */
export function sampleModelSurfacePoints(
  root: Object3D,
  count: number
): Float32Array | null {
  const { triangles, totalArea } = collectWeightedTriangles(root);
  if (triangles.length === 0 || totalArea === 0) return null;

  const points = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const picked = findTriangleAt(triangles, Math.random() * totalArea);

    // Uniform barycentric sample: the square root biases toward the far edge,
    // which is what keeps the distribution even rather than corner-heavy.
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;

    const offset = i * 3;
    points[offset] = picked.a.x * w + picked.b.x * u + picked.c.x * v;
    points[offset + 1] = picked.a.y * w + picked.b.y * u + picked.c.y * v;
    points[offset + 2] = picked.a.z * w + picked.b.z * u + picked.c.z * v;
  }

  return points;
}

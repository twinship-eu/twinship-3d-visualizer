/**
 * =============================================================================
 * simplify-mesh-keeping-shading.mjs
 *
 * Decimates the geometry under named nodes of a ship GLB, keeping its shading:
 * meshoptimizer's attribute-aware simplifier, weighing the normals and the
 * texture coordinates as well as the shape, so an edge collapse that would
 * bend a hard edge's normals or stretch the texture costs as much as one that
 * moves the surface, and is refused past the error ceiling.
 *
 * For parts with hard edges — the containers, the crane. `simplify-engine-mesh.mjs`
 * welds first and weighs only the shape: on those parts it rounded the hard
 * edges' shading off, even at 60-70% kept. Their meshes are indexed already,
 * so nothing is welded here: vertices split along a hard edge or a texture
 * seam stay split.
 *
 * Usage:
 *   node scripts/simplify-mesh-keeping-shading.mjs <source.glb> <output.glb> <ratio> <nodeNames> [error]
 *
 *   ratio      fraction of triangles to keep, 0-1: a target, reached only
 *              within the error
 *   nodeNames  top-level nodes whose subtrees are simplified, comma-separated
 *   error      allowed deviation as a fraction of the mesh's size; defaults to 0.005
 * =============================================================================
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { compactPrimitive } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const DEFAULT_MAX_ERROR = 0.005;
/** How much a change of normal (unit vectors) weighs against one of the shape. */
const NORMAL_WEIGHT = 1.0;
/** How much a change of texture coordinates (0-1 across the map) weighs. */
const UV_WEIGHT = 1.0;
/** Primitives below this many triangles are left alone: nothing to gain. */
const MIN_TRIANGLES_TO_SIMPLIFY = 256;

const [sourcePath, outputPath, ratioArg, nodeNamesArg, errorArg] = process.argv.slice(2);
const ratio = Number(ratioArg);
const maxError = errorArg === undefined ? DEFAULT_MAX_ERROR : Number(errorArg);
if (!sourcePath || !outputPath || !Number.isFinite(ratio) || !nodeNamesArg) {
  console.error(
    "Usage: node scripts/simplify-mesh-keeping-shading.mjs <source.glb> <output.glb> <ratio> <nodeNames> [error]"
  );
  process.exit(1);
}
const nodeNames = nodeNamesArg.split(",");

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const document = await io.read(sourcePath);
const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];

/** An accessor's elements as floats, dequantised: the file's may be normalised integers. */
function readFloats(accessor, size) {
  const out = new Float32Array(accessor.getCount() * size);
  const element = [];
  for (let index = 0; index < accessor.getCount(); index++) {
    accessor.getElement(index, element);
    for (let component = 0; component < size; component++) out[index * size + component] = element[component];
  }
  return out;
}

function countTriangles(primitive) {
  return (primitive.getIndices()?.getCount() ?? 0) / 3;
}

function collectPrimitives(node, into) {
  const mesh = node.getMesh();
  if (mesh) into.push(...mesh.listPrimitives());
  for (const child of node.listChildren()) collectPrimitives(child, into);
  return into;
}

/** The normals and uvs side by side, and their weights, for the simplifier. */
function attributesOf(primitive) {
  const normal = primitive.getAttribute("NORMAL");
  const uv = primitive.getAttribute("TEXCOORD_0");
  const parts = [
    ...(normal ? [{ values: readFloats(normal, 3), size: 3, weight: NORMAL_WEIGHT }] : []),
    ...(uv ? [{ values: readFloats(uv, 2), size: 2, weight: UV_WEIGHT }] : []),
  ];
  const stride = parts.reduce((sum, part) => sum + part.size, 0);
  const count = primitive.getAttribute("POSITION").getCount();
  const values = new Float32Array(count * stride);
  let offset = 0;
  for (const part of parts) {
    for (let vertex = 0; vertex < count; vertex++) {
      for (let component = 0; component < part.size; component++) {
        values[vertex * stride + offset + component] = part.values[vertex * part.size + component];
      }
    }
    offset += part.size;
  }
  const weights = parts.flatMap((part) => new Array(part.size).fill(part.weight));

  return { values, stride, weights };
}

function simplify(primitive) {
  const indices = primitive.getIndices();
  if (!indices) return;
  const positions = readFloats(primitive.getAttribute("POSITION"), 3);
  const attributes = attributesOf(primitive);
  const source = new Uint32Array(indices.getArray());
  const target = Math.floor((source.length * ratio) / 3) * 3;

  const [simplified] = MeshoptSimplifier.simplifyWithAttributes(
    source,
    positions,
    3,
    attributes.values,
    attributes.stride,
    attributes.weights,
    null,
    target,
    maxError
  );
  indices.setArray(simplified);
  // The vertices no triangle uses any more
  compactPrimitive(primitive);
}

const format = (value) => Math.round(value).toLocaleString("en-US");
for (const name of nodeNames) {
  const node = scene.listChildren().find((child) => child.getName() === name);
  if (!node) {
    console.error(`Node "${name}" not found.`);
    process.exit(1);
  }
  const primitives = collectPrimitives(node, []);
  const before = primitives.reduce((sum, primitive) => sum + countTriangles(primitive), 0);
  for (const primitive of primitives) {
    if (countTriangles(primitive) >= MIN_TRIANGLES_TO_SIMPLIFY) simplify(primitive);
  }
  const after = primitives.reduce((sum, primitive) => sum + countTriangles(primitive), 0);
  console.log(`${name}: ${format(before)} -> ${format(after)} triangles (${((after / before) * 100).toFixed(1)}% kept)`);
}

await io.write(outputPath, document);
console.log(`Wrote ${outputPath}`);

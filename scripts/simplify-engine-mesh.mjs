/**
 * =============================================================================
 * simplify-engine-mesh.mjs
 *
 * Decimates the geometry under a single named node of a ship GLB, leaving every
 * other part untouched.
 *
 * Exists because the engine export's `Engine` node is ~495k triangles against
 * ~108k in the shipped model, while every other part of the two models is
 * identical. Whole-model simplification would decimate parts that are already
 * the right density, so this targets one node.
 *
 * Welds before simplifying: meshoptimizer collapses edges, and an unwelded
 * mesh has no shared edges to collapse, so simplification would barely reduce
 * anything.
 *
 * Usage:
 *   node scripts/simplify-engine-mesh.mjs <source.glb> <output.glb> <ratio> [nodeName]
 *
 *   ratio     fraction of triangles to keep, 0-1
 *   nodeName  node whose subtree is simplified; defaults to "Engine"
 * =============================================================================
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { simplifyPrimitive, weldPrimitive } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

/** Allowed error, as a fraction of mesh radius, before simplification stops. */
const MAX_ERROR = 0.01;

const [sourcePath, outputPath, ratioArg, nodeNameArg] = process.argv.slice(2);
const ratio = Number(ratioArg);
const targetNodeName = nodeNameArg ?? "Engine";

if (!sourcePath || !outputPath || !Number.isFinite(ratio)) {
  console.error(
    "Usage: node scripts/simplify-engine-mesh.mjs <source.glb> <output.glb> <ratio> [nodeName]"
  );
  process.exit(1);
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

const document = await io.read(sourcePath);
const scene =
  document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];

function countTriangles(primitive) {
  const indices = primitive.getIndices();
  const count = indices
    ? indices.getCount()
    : (primitive.getAttribute("POSITION")?.getCount() ?? 0);
  return count / 3;
}

/** Every primitive in a node's subtree. */
function collectPrimitives(node, into) {
  const mesh = node.getMesh();
  if (mesh) into.push(...mesh.listPrimitives());
  for (const child of node.listChildren()) collectPrimitives(child, into);
  return into;
}

const targetNode = scene
  .listChildren()
  .find((node) => node.getName() === targetNodeName);

if (!targetNode) {
  console.error(
    `Node "${targetNodeName}" not found. Top-level nodes: ${scene
      .listChildren()
      .map((n) => n.getName())
      .join(", ")}`
  );
  process.exit(1);
}

const primitives = collectPrimitives(targetNode, []);
const before = primitives.reduce((sum, p) => sum + countTriangles(p), 0);

for (const primitive of primitives) {
  weldPrimitive(primitive);
  simplifyPrimitive(primitive, {
    simplifier: MeshoptSimplifier,
    ratio,
    error: MAX_ERROR,
  });
}

const after = primitives.reduce((sum, p) => sum + countTriangles(p), 0);

await io.write(outputPath, document);

const format = (value) => Math.round(value).toLocaleString("en-US");
console.log(
  `${targetNodeName}: ${format(before)} -> ${format(after)} triangles ` +
    `(${((after / before) * 100).toFixed(1)}% kept, requested ${(
      ratio * 100
    ).toFixed(0)}%)`
);
console.log(`Wrote ${outputPath}`);

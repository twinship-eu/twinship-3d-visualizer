#!/usr/bin/env node
/**
 * split-propellers.mjs
 *
 * The update export (TwinShip_UPDATE 1.glb) has its propellers merged into the
 * hull's mesh (`Base`, its `M_Ship_Deck` part) instead of a `Propellers` node
 * of their own. The viewer needs that node: the tree selects it, the
 * propellers spin about it, callouts, alarms and the knowledge graph point at
 * it. This takes the triangles of that part that lie in the propellers' box —
 * at the stern, below the waterline, off the centreline — out of `Base` into a
 * new top-level `Propellers` node, at the same place in the world.
 *
 * Run on the raw export, before optimize-ship-model.sh.
 *
 * Usage: node scripts/split-propellers.mjs <source.glb> <output.glb>
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const [source, output] = process.argv.slice(2);
if (!source || !output) {
  console.error("Usage: node scripts/split-propellers.mjs <source.glb> <output.glb>");
  process.exit(1);
}

/** The hull node, the part the propellers are merged into, and the name of the node they go to. */
const HULL_NODE = "Base";
const PROPELLER_MATERIAL = "M_Ship_Deck";
const PROPELLERS_NODE = "Propellers";
/**
 * The propellers' box, in world units — where the previous export's own
 * `Propellers` node was (x -9..9, y -8.9..-3.5, z -98..-91), with some margin.
 */
const BOX = { minX: -10, maxX: 10, minY: -9.5, maxY: -3.0, minZ: -100.5, maxZ: -88 };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(source);
const root = document.getRoot();
const scene = root.listScenes()[0];

if (root.listNodes().some((node) => node.getName() === PROPELLERS_NODE)) {
  console.log(`${source} already has a ${PROPELLERS_NODE} node: copied unchanged.`);
  await io.write(output, document);
  process.exit(0);
}

const hull = root.listNodes().find((node) => node.getName() === HULL_NODE);
const part = hull?.getMesh()?.listPrimitives().find((primitive) => primitive.getMaterial()?.getName() === PROPELLER_MATERIAL);
if (!hull || !part) {
  console.error(`No ${HULL_NODE} node with a ${PROPELLER_MATERIAL} part in ${source}.`);
  process.exit(1);
}

const [tx, ty, tz] = hull.getTranslation();
const positions = part.getAttribute("POSITION");
const indices = part.getIndices();
const vertex = [0, 0, 0];
const isInBox = (index) => {
  positions.getElement(index, vertex);
  const [x, y, z] = [vertex[0] + tx, vertex[1] + ty, vertex[2] + tz];
  return x >= BOX.minX && x <= BOX.maxX && y >= BOX.minY && y <= BOX.maxY && z >= BOX.minZ && z <= BOX.maxZ;
};

// Each triangle wholly in the box is the propellers'; the rest stays the hull's
const kept = [];
const taken = [];
for (let triangle = 0; triangle < indices.getCount(); triangle += 3) {
  const corners = [indices.getScalar(triangle), indices.getScalar(triangle + 1), indices.getScalar(triangle + 2)];
  (corners.every(isInBox) ? taken : kept).push(...corners);
}
if (taken.length === 0) {
  console.error("No triangles found in the propellers' box: nothing split.");
  process.exit(1);
}

// The propellers' part: its own copy of the attributes, reindexed to the vertices it uses
const used = [...new Set(taken)];
const remap = new Map(used.map((oldIndex, newIndex) => [oldIndex, newIndex]));
const propellerPart = document.createPrimitive().setMaterial(part.getMaterial());
for (const semantic of part.listSemantics()) {
  const attribute = part.getAttribute(semantic);
  const size = attribute.getElementSize();
  const ArrayType = attribute.getArray().constructor;
  const array = new ArrayType(used.length * size);
  const element = new Array(size).fill(0);
  used.forEach((oldIndex, newIndex) => {
    attribute.getElement(oldIndex, element);
    for (let component = 0; component < size; component++) array[newIndex * size + component] = element[component];
  });
  propellerPart.setAttribute(
    semantic,
    document.createAccessor().setType(attribute.getType()).setArray(array).setNormalized(attribute.getNormalized()).setBuffer(attribute.getBuffer())
  );
}
propellerPart.setIndices(
  document.createAccessor().setType("SCALAR").setArray(new Uint32Array(taken.map((index) => remap.get(index)))).setBuffer(indices.getBuffer())
);

// The hull keeps the rest
part.setIndices(document.createAccessor().setType("SCALAR").setArray(new Uint32Array(kept)).setBuffer(indices.getBuffer()));

const propellers = document
  .createNode(PROPELLERS_NODE)
  .setMesh(document.createMesh(PROPELLERS_NODE).addPrimitive(propellerPart))
  .setTranslation([tx, ty, tz])
  .setRotation(hull.getRotation())
  .setScale(hull.getScale());
scene.addChild(propellers);

await io.write(output, document);
console.log(`${PROPELLERS_NODE}: ${taken.length / 3} triangles taken from ${HULL_NODE}/${PROPELLER_MATERIAL} (${kept.length / 3} left there).`);

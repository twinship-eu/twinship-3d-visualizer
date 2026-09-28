/**
 * =============================================================================
 * decode-webp-textures.mjs
 *
 * Re-encodes a GLB's WebP textures as PNG, losslessly, leaving everything else
 * as it is. A step before KTX2 (`encode-ship-textures-ktx2.sh`): KTX-Software's
 * encoder reads only PNG and JPEG.
 *
 * Usage:
 *   node scripts/decode-webp-textures.mjs <source.glb> <output.glb>
 * =============================================================================
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const [source, output] = process.argv.slice(2);
if (!source || !output) {
  console.error("Usage: node scripts/decode-webp-textures.mjs <source.glb> <output.glb>");
  process.exit(1);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const document = await io.read(source);
await document.transform(
  textureCompress({ encoder: sharp, targetFormat: "png", slots: /.*/, pattern: /.*/ })
);
// No WebP left: the extension would still be declared as required
document
  .getRoot()
  .listExtensionsUsed()
  .filter((extension) => extension.extensionName === "EXT_texture_webp")
  .forEach((extension) => extension.dispose());
await io.write(output, document);

const pngCount = document
  .getRoot()
  .listTextures()
  .filter((texture) => texture.getMimeType() === "image/png").length;
console.log(`${pngCount} textures as PNG -> ${output}`);

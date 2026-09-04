#!/bin/bash

# =============================================================================
# optimize-ship-model.sh
#
# Turns the raw Blender GLB export (4K PNG textures, uncompressed geometry,
# ~176 MB) into a web-deliverable GLB (WebP textures + Meshopt geometry).
#
# Node names and the scene graph are preserved on purpose: the Ship Visualizer
# builds its component tree from the top-level nodes, so `flatten`, `join` and
# `instance` must never run here.
#
# Requires the @gltf-transform/cli devDependency.
#
# Usage: npm run optimize:ship-model
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SOURCE_GLB="$PROJECT_ROOT/public/ship/TwinShip_Update/TwinShip_Update.glb"
OUTPUT_GLB="$PROJECT_ROOT/public/ship/twinship-v3.glb"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# Max edge for the PBR maps. 4K is not an option: WebP is only a transport
# format, so every map is expanded to uncompressed RGBA on the GPU. At 4096 the
# 19 maps cost ~1.6 GB of VRAM, which fails on integrated GPUs; 2048 costs
# ~405 MB. Going below 2048 visibly washes out the hull surface grunge.
PBR_TEXTURE_SIZE=2048
# The decal atlas is text and logos, where soft edges are obvious. It keeps
# both the higher resolution and, being one small texture, costs little.
DECAL_TEXTURE_SIZE=2048
# Texture name (glob) of the decal atlas, matched against the others by negation.
DECAL_PATTERN="Atlas*"

# Near-lossless rather than plain lossy WebP. The maps are close to flat over
# large areas, and ordinary lossy WebP flattens each DCT block to a single
# value there - which renders as a grid of visible squares across the hull.
# Even quality 95 left errors of ~100/255; near-lossless caps them at ~4 while
# still shrinking the textures roughly 30x.
WEBP_QUALITY=40

if [ ! -f "$SOURCE_GLB" ]; then
    echo "Error: source model not found at $SOURCE_GLB"
    exit 1
fi

GLTF_TRANSFORM="npx --no-install gltf-transform"

echo "1/5 Resizing PBR maps to ${PBR_TEXTURE_SIZE}px..."
$GLTF_TRANSFORM resize "$SOURCE_GLB" "$WORK_DIR/pbr.glb" \
    --pattern "!($DECAL_PATTERN)" \
    --width "$PBR_TEXTURE_SIZE" --height "$PBR_TEXTURE_SIZE"

echo "2/5 Resizing decal atlas to ${DECAL_TEXTURE_SIZE}px..."
$GLTF_TRANSFORM resize "$WORK_DIR/pbr.glb" "$WORK_DIR/resized.glb" \
    --pattern "$DECAL_PATTERN" \
    --width "$DECAL_TEXTURE_SIZE" --height "$DECAL_TEXTURE_SIZE"

echo "3/5 Encoding textures to near-lossless WebP..."
$GLTF_TRANSFORM webp "$WORK_DIR/resized.glb" "$WORK_DIR/textures.glb" \
    --near-lossless true --quality "$WEBP_QUALITY"

echo "4/5 Removing unused data..."
$GLTF_TRANSFORM prune "$WORK_DIR/textures.glb" "$WORK_DIR/pruned.glb"
$GLTF_TRANSFORM dedup "$WORK_DIR/pruned.glb" "$WORK_DIR/deduped.glb"

echo "5/5 Compressing geometry with Meshopt..."
# Meshopt (not Draco) because its decoder ships inside three-stdlib, so the
# viewer needs no external decoder download at runtime.
$GLTF_TRANSFORM meshopt "$WORK_DIR/deduped.glb" "$OUTPUT_GLB" --level high

echo ""
echo "Done: $OUTPUT_GLB"
ls -lh "$SOURCE_GLB" "$OUTPUT_GLB" | awk '{print "  " $5 "\t" $9}'

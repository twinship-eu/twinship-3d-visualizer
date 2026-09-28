#!/bin/bash

# =============================================================================
# encode-ship-textures-ktx2.sh
#
# Re-encodes an optimised ship GLB's textures as KTX2 (KHR_texture_basisu):
# GPU-compressed, so they stay compressed in GPU memory. A WebP or PNG map is
# only a transport format, expanded to 4 bytes a texel on the GPU: the engine
# model's 34 maps at 2048 took ~760 MB there, as KTX2 ~130 MB.
#
# - Normal maps: UASTC, high quality. ETC1S's blocks show as facets in the
#   lighting.
# - Base colour and metal/roughness: ETC1S, small; at quality 255 no
#   difference showed on the hull against the WebP build.
#
# Geometry and the scene graph are untouched (see optimize-ship-model.sh for
# why they must be).
#
# Requires KTX-Software's `toktx` (https://github.com/KhronosGroup/KTX-Software,
# 4.3 or later) on the PATH. It is not in Homebrew; its release .pkg can be
# unpacked without installing:
#   pkgutil --expand-full KTX-Software-<version>-Darwin-arm64.pkg ktx
# then point KTX_HOME at a folder holding its bin/ (toktx) and lib/ (libktx).
#
# Usage: scripts/encode-ship-textures-ktx2.sh <source.glb> <output.glb>
#   e.g. scripts/encode-ship-textures-ktx2.sh public/ship/twinship-engine.glb \
#          public/ship/twinship-engine-ktx2.glb
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_GLB="${1:?source GLB}"
OUTPUT_GLB="${2:?output GLB}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

if [ -n "${KTX_HOME:-}" ]; then
    export PATH="$KTX_HOME/bin:$PATH"
    export DYLD_LIBRARY_PATH="$KTX_HOME/lib${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
fi
if ! command -v toktx >/dev/null; then
    echo "Error: toktx not found. Put KTX-Software on the PATH, or set KTX_HOME (see the header)."
    exit 1
fi

# UASTC: RDO lets zstd shrink it; a low lambda keeps normals accurate
UASTC_LEVEL=2
UASTC_RDO_LAMBDA=1
# ETC1S: the highest quality; the maps are small enough in it anyway
ETC1S_QUALITY=255
ZSTD_LEVEL=18
JOBS=8

GLTF_TRANSFORM="npx --no-install gltf-transform"

echo "1/4 WebP to PNG (toktx reads only PNG and JPEG)..."
node "$SCRIPT_DIR/decode-webp-textures.mjs" "$SOURCE_GLB" "$WORK_DIR/png.glb"

echo "2/4 Normal maps to UASTC..."
$GLTF_TRANSFORM uastc "$WORK_DIR/png.glb" "$WORK_DIR/normals.glb" \
    --slots "normalTexture" --level "$UASTC_LEVEL" \
    --rdo --rdo-lambda "$UASTC_RDO_LAMBDA" --zstd "$ZSTD_LEVEL" --jobs "$JOBS"

echo "3/4 The other maps to ETC1S..."
$GLTF_TRANSFORM etc1s "$WORK_DIR/normals.glb" "$WORK_DIR/textures.glb" \
    --quality "$ETC1S_QUALITY" --jobs "$JOBS"

echo "4/4 Compressing geometry with Meshopt again..."
$GLTF_TRANSFORM meshopt "$WORK_DIR/textures.glb" "$OUTPUT_GLB" --level high

echo ""
echo "Done: $OUTPUT_GLB"
ls -lh "$SOURCE_GLB" "$OUTPUT_GLB" | awk '{print "  " $5 "\t" $9}'

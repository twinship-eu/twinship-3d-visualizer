import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import type { GLTFLoader } from "three-stdlib";

/**
 * Where the Basis Universal transcoder is served from: copied from
 * `three/examples/jsm/libs/basis/`, and to be copied again when three is
 * upgraded, so it matches the loader.
 */
const BASIS_TRANSCODER_PATH = "/basis/";

let loader: KTX2Loader | null = null;

/**
 * The one KTX2 loader, for the ship's GPU-compressed textures (KHR_texture_basisu).
 * It transcodes each texture to what this GPU reads natively (ASTC, ETC2 or
 * BC7), so the texture stays compressed in GPU memory — a WebP or PNG is
 * expanded to 4 bytes a texel there.
 *
 * @param renderer the scene's renderer, initialised: its GPU's formats are read from it
 */
export function getKtx2Loader(renderer: Parameters<KTX2Loader["detectSupport"]>[0]) {
  if (loader === null) {
    loader = new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH);
    loader.detectSupport(renderer);
  }

  return loader;
}

/** Hands a GLTF loader the KTX2 loader: for drei's `useGLTF(path, draco, meshopt, extendLoader)`. */
export function withKtx2Textures(renderer: Parameters<KTX2Loader["detectSupport"]>[0]) {
  // three's own KTX2Loader: three-stdlib's is older and does not know the
  // WebGPU renderer. The GLTF loader only calls its `load`, which both share
  return (gltfLoader: GLTFLoader) =>
    gltfLoader.setKTX2Loader(getKtx2Loader(renderer) as unknown as Parameters<GLTFLoader["setKTX2Loader"]>[0]);
}

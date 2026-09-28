/**
 * Seascape — 9. FFT ocean
 *
 * The sea as a sum of thousands of waves, the way film and game oceans are
 * made (Tessendorf, "Simulating Ocean Water", 2001). The wind's JONSWAP
 * spectrum is sampled on a grid of wavenumbers; each sample is one wave with a
 * random phase, running at its deep-water speed; an inverse FFT adds them all
 * up into a height field and its slopes, every frame.
 *
 * One FFT grid of 256 × 256 spans only so many scales, so the sea is three
 * such cascades, each a tile of its own size — hundreds of metres, then about
 * fourteen times smaller, twice over — each holding the waves of its band.
 * Together they run from the longest swell down to ripples of centimetres.
 * The tiles' sizes are unrelated, so their repeats never line up.
 *
 * - the spectrum (`buildCascadeSpectrum`) is computed on the CPU, only when the
 *   wind changes;
 * - every frame, a compute pass turns it into this moment's waves (height and
 *   both slopes), the FFT adds them up, and a last pass writes the result to a
 *   texture the surface samples.
 */
import {
  cos,
  float,
  Fn,
  If,
  instanceIndex,
  sin,
  sqrt,
  storage,
  textureStore,
  uint,
  uniform,
  uvec2,
  vec2,
  vec4,
} from "three/tsl";
import {
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  StorageBufferAttribute,
  StorageTexture,
  Vector4,
  type Node,
  type Renderer,
} from "three/webgpu";
import { createGpuFft } from "./seascape-fft-tsl";
import {
  buildCascadeSpectrum,
  cascadeBands,
  cascadeTileSizes,
  FFT_CASCADES,
  FFT_SIZE,
  seededRandom,
  SPECTRUM_SEED,
} from "./seascape-fft-spectrum";
import { jonswapParameters, type Wind } from "./seascape-wind-waves";

export { FFT_CASCADES, FFT_SIZE };

/** Standard gravity, m/s². */
const GRAVITY = 9.81;



/** Anisotropic filtering of the cascades, for water seen at grazing angles. */
const FFT_TEXTURE_ANISOTROPY = 8;


export type FftCascade = {
  /** Tile size, in metres. */
  tileSize: number;
  /** Height, slope x, slope z (r, g, b), tiled over `tileSize` metres. */
  texture: StorageTexture;
};

/** A float uniform, as `uniform(number)` makes it. */
type FloatUniform = ReturnType<typeof makeFloatUniform>;
function makeFloatUniform(value: number) {
  return uniform(value);
}

/**
 * The cascades' GPU side: one spectrum buffer and one FFT for all of them,
 * layer after layer, so each step is a single dispatch for every cascade.
 * (Per cascade, the ocean took 54 dispatches a frame, each costing the CPU
 * ~0.1 ms to issue; now 18.)
 */
function createOceanGpu(seconds: FloatUniform) {
  const cells = FFT_SIZE * FFT_SIZE;
  const allCells = cells * FFT_CASCADES;
  const spectrum = new StorageBufferAttribute(new Float32Array(allCells * 4), 4);
  const spectrumNode = storage(spectrum, "vec4", allCells);
  /** The cascades' tile sizes, in x, y, z. */
  const tileSizes = uniform(new Vector4(1, 1, 1, 1));
  const fft = createGpuFft(FFT_SIZE, FFT_CASCADES);

  /** Which cascade an element of the buffers belongs to, and where it is in its own grid. */
  const layerOf = () => instanceIndex.div(uint(cells));
  const cellOf = () => instanceIndex.mod(uint(cells));
  const tileSizeOf = (layer: Node<"uint">) =>
    layer.equal(uint(0)).select(tileSizes.x, layer.equal(uint(1)).select(tileSizes.y, tileSizes.z));

  // This moment's waves: h(k, t) = h0(k) e^{-iωt} + conj(h0(-k)) e^{iωt}, and
  // its slopes i·kx·h, i·kz·h — packed as (h + i·slopeX, slopeZ), two real
  // fields per complex transform
  const evolve = Fn(() => {
    const cell = cellOf();
    const row = cell.div(uint(FFT_SIZE));
    const column = cell.mod(uint(FFT_SIZE));
    const signedColumn = column.toFloat().sub(column.greaterThanEqual(uint(FFT_SIZE / 2)).select(FFT_SIZE, 0));
    const signedRow = row.toFloat().sub(row.greaterThanEqual(uint(FFT_SIZE / 2)).select(FFT_SIZE, 0));
    const spacing = float(2 * Math.PI).div(tileSizeOf(layerOf()));
    const kx = signedColumn.mul(spacing);
    const kz = signedRow.mul(spacing);
    const frequency = sqrt(sqrt(kx.mul(kx).add(kz.mul(kz))).mul(GRAVITY));

    const initial = spectrumNode.element(instanceIndex);
    const phase = frequency.mul(seconds);
    const turn = vec2(cos(phase), sin(phase));
    // h0 · e^{-iφ} + conj0 · e^{+iφ}: with the sum over e^{ik·x}, the h0(k)
    // term then runs along +k — downwind, where the spectrum puts its energy.
    // (Tessendorf's paper writes e^{+iωt} there, which runs the waves the
    // other way: here they travelled into the wind, with the foam on their
    // leading faces.)
    const forward = vec2(initial.x.mul(turn.x).add(initial.y.mul(turn.y)), initial.y.mul(turn.x).sub(initial.x.mul(turn.y)));
    const backward = vec2(initial.z.mul(turn.x).sub(initial.w.mul(turn.y)), initial.z.mul(turn.y).add(initial.w.mul(turn.x)));
    const height = forward.add(backward);

    // i·k·h = (-k·h.y, k·h.x); h + i·(i·kx·h) = (1 - kx)·h
    const heightAndSlopeX = height.mul(float(1.0).sub(kx));
    const slopeZ = vec2(height.y.negate(), height.x).mul(kz);

    fft.dataNode.element(instanceIndex).assign(vec4(heightAndSlopeX, slopeZ));
  })().compute(allCells);

  // The result, (height, slope x, slope z), into a texture per cascade that
  // the surface samples. Half floats: filterable, so three regenerates their
  // mipmaps after every write, and the waves too short for a pixel average
  // out instead of aliasing
  const textures = Array.from({ length: FFT_CASCADES }, () => {
    const texture = new StorageTexture(FFT_SIZE, FFT_SIZE);
    texture.type = HalfFloatType;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = FFT_TEXTURE_ANISOTROPY;

    return texture;
  });

  const store = Fn(() => {
    const layer = layerOf();
    const cell = cellOf();
    const at = uvec2(cell.mod(uint(FFT_SIZE)), cell.div(uint(FFT_SIZE)));
    const result = fft.dataNode.element(instanceIndex);
    const value = vec4(result.x, result.y, result.z, 1.0);

    textures.forEach((texture, index) => {
      If(layer.equal(uint(index)), () => {
        textureStore(texture, at, value).toWriteOnly();
      });
    });
  })().compute(allCells);

  return { spectrum, tileSizes, fft, passes: [evolve, ...fft.passes, store], textures, cells };
}

/**
 * The FFT ocean: its cascades' textures, and the calls that keep them current.
 */
export function createFftOcean(wind: Wind) {
  const seconds = makeFloatUniform(0);
  const gpu = createOceanGpu(seconds);
  const cascades: FftCascade[] = gpu.textures.map((texture) => ({ tileSize: 1, texture }));

  /** Recomputes the spectrum for a wind: on the CPU, a few tens of milliseconds. */
  function setWind(nextWind: Wind) {
    const { peakFrequency } = jonswapParameters(nextWind);
    const peakWavelength = (2 * Math.PI * GRAVITY) / (peakFrequency * peakFrequency);
    const tileSizes = cascadeTileSizes(peakWavelength);
    const bands = cascadeBands(tileSizes);
    const random = seededRandom(SPECTRUM_SEED);

    tileSizes.forEach((tileSize, index) => {
      gpu.spectrum.array.set(buildCascadeSpectrum(nextWind, tileSize, bands[index], random), index * gpu.cells * 4);
      cascades[index].tileSize = tileSize;
    });
    gpu.spectrum.needsUpdate = true;
    gpu.tileSizes.value.set(tileSizes[0], tileSizes[1], tileSizes[2], 1);
  }

  /** Brings the waves to `time` seconds: evolve, FFT and store, for every cascade at once. */
  function update(renderer: Renderer, time: number) {
    seconds.value = time;
    // All the passes in one call: one command submission for the frame's ocean
    renderer.compute(gpu.passes);
  }

  setWind(wind);

  return { cascades, setWind, update, gpu };
}

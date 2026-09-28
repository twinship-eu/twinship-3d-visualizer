/**
 * Seascape — 8. GPU FFT
 *
 * A 2D inverse Fourier transform on the GPU, for the FFT ocean: it turns a
 * spectrum — thousands of waves, each an amplitude and a phase — into the sea
 * they add up to, all at once, every frame.
 *
 * Radix-2 Stockham, one compute pass per stage: log2(N) passes along the rows,
 * then log2(N) along the columns, ping-ponging between two storage buffers.
 * Stockham's ordering needs no bit-reversal pass: every stage reads in natural
 * order and writes in natural order.
 *
 * Each buffer element is a vec4 holding two complex numbers (xy and zw), so
 * one transform carries two fields. Several grids (`layers`) are transformed
 * by the same passes, one after another in the buffer: each pass is one
 * dispatch whatever the number of grids, and a dispatch costs the CPU far
 * more than the GPU's work in it. The transform is not normalised: it
 * computes f(x) = Σ_k F(k) e^{+2πi k·x / N}, a plain sum of waves, which is
 * what the spectrum's amplitudes are defined for.
 */
import { cos, Fn, instanceIndex, sin, storage, uint, vec2, vec4 } from "three/tsl";
import { StorageBufferAttribute, type ComputeNode, type Node, type StorageBufferNode } from "three/webgpu";

/** Complex product (a.x + i a.y)(b.x + i b.y). */
function complexMultiply(a: Node<"vec2">, b: Node<"vec2">) {
  return vec2(a.x.mul(b.x).sub(a.y.mul(b.y)), a.x.mul(b.y).add(a.y.mul(b.x)));
}

export type GpuFft = {
  /** Grid size along each axis: a power of two. */
  size: number;
  /** Where the input is written before `passes` run, and where the result ends. */
  data: StorageBufferAttribute;
  /** The storage node reading and writing `data`, for other compute passes. */
  dataNode: StorageBufferNode<"vec4">;
  /** The transform's passes, in order; the result is back in `data`. */
  passes: ComputeNode[];
};

/**
 * Builds a 2D inverse FFT of `layers` grids of size × size, for two complex
 * fields packed in each vec4. Grid `l` starts at element l · size².
 */
export function createGpuFft(size: number, layers = 1): GpuFft {
  const stages = Math.log2(size);
  if (!Number.isInteger(stages)) throw new Error(`GPU FFT size must be a power of two, got ${size}`);

  const cellsPerLayer = size * size;
  const elements = cellsPerLayer * layers;
  const data = new StorageBufferAttribute(new Float32Array(elements * 4), 4);
  const scratch = new StorageBufferAttribute(new Float32Array(elements * 4), 4);
  const dataNode = storage(data, "vec4", elements);
  const scratchNode = storage(scratch, "vec4", elements);

  const half = size / 2;
  const passes: ComputeNode[] = [];
  let source = dataNode;
  let target = scratchNode;

  for (const axis of ["rows", "columns"] as const) {
    for (let stage = 0; stage < stages; stage++) {
      const span = 1 << stage;
      const read = source;
      const write = target;

      const pass = Fn(() => {
        // One thread per butterfly: size / 2 of them along each of `size`
        // lines of each grid
        const lineOfAll = instanceIndex.div(uint(half));
        const layer = lineOfAll.div(uint(size));
        const line = lineOfAll.mod(uint(size));
        const layerStart = layer.mul(uint(cellsPerLayer));
        const i = instanceIndex.mod(uint(half));
        const k = i.mod(uint(span));

        // Positions along the line, turned into buffer indices for this axis
        const at = (position: Node<"uint">) =>
          layerStart.add(axis === "rows" ? line.mul(uint(size)).add(position) : position.mul(uint(size)).add(line));

        const even = read.element(at(i));
        const odd = read.element(at(i.add(uint(half))));

        // Twiddle e^{+iπk/span}
        const angle = k.toFloat().mul(Math.PI / span);
        const twiddle = vec2(cos(angle), sin(angle));
        const oddFirst = complexMultiply(odd.xy, twiddle);
        const oddSecond = complexMultiply(odd.zw, twiddle);

        const out = i.sub(k).mul(uint(2)).add(k);
        write.element(at(out)).assign(vec4(even.xy.add(oddFirst), even.zw.add(oddSecond)));
        write.element(at(out.add(uint(span)))).assign(vec4(even.xy.sub(oddFirst), even.zw.sub(oddSecond)));
      })().compute(size * half * layers);

      passes.push(pass);
      [source, target] = [target, source];
    }
  }

  // 2·log2(size) passes: an even count, so the result is back in `data`
  return { size, data, dataNode, passes };
}

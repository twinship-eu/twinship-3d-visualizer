"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { pass, renderOutput } from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { fxaa } from "three/examples/jsm/tsl/display/FXAANode.js";
import { RenderPipeline, type Camera, type Scene } from "three/webgpu";
import { IS_SCENE_INSPECTOR_ENABLED } from "../lib/3d-scene-config";
import { asSceneRenderer, getSceneInspector } from "../lib/webgpu-renderer";

/**
 * Bloom, as Bruno Simon sets it up: no threshold and a low strength, so
 * everything glows a little, in proportion to how bright it is. To make
 * something glow, its colour is pushed past white (the buoys' lamps: × 5);
 * the rest of the scene barely changes.
 */
const BLOOM = {
  isEnabled: true,
  // 0.15 (Bruno Simon's) made the whole scene too bright and soft
  strength: 0.05,
  radius: 0.4,
  threshold: 0,
} as const;

/** After R3F's default (0): a positive priority makes this the frame's only render. */
const RENDER_PRIORITY = 1;

/** Live values behind the Inspector's Bloom panel. */
const BLOOM_TUNING = {
  bloom: BLOOM.isEnabled as boolean,
  strength: BLOOM.strength as number,
  radius: BLOOM.radius as number,
  threshold: BLOOM.threshold as number,
};

function createPipeline(renderer: ReturnType<typeof asSceneRenderer>, scene: Scene, camera: Camera) {
  const scenePass = pass(scene, camera).getTextureNode("output");
  const bloomPass = bloom(scenePass, BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  const pipeline = new RenderPipeline(renderer);
  // Tone mapping and colour space done by hand, before FXAA, which needs the
  // final, display-ready colours to find the edges it smooths
  pipeline.outputColorTransform = false;

  /** The chain: the scene, its bloom if on, the colour transform, then FXAA. */
  const outputFor = (withBloom: boolean) => fxaa(renderOutput(withBloom ? scenePass.add(bloomPass) : scenePass));
  pipeline.outputNode = outputFor(BLOOM.isEnabled);

  return { pipeline, bloomPass, outputFor, withBloom: BLOOM.isEnabled as boolean };
}

/**
 * Renders the scene through three's TSL render pipeline, with a bloom pass and
 * FXAA (the canvas is not multisampled: the passes render to their own targets):
 * takes over the frame's rendering from R3F.
 */
export function SceneRenderPipeline() {
  const get = useThree((state) => state.get);
  const pipelineRef = useRef<ReturnType<typeof createPipeline> | null>(null);

  useEffect(() => {
    if (!IS_SCENE_INSPECTOR_ENABLED) return;
    const inspector = getSceneInspector(asSceneRenderer(get().gl));
    if (inspector === null) return;

    const panel = inspector.createParameters("Bloom");
    panel.add(BLOOM_TUNING, "bloom");
    panel.add(BLOOM_TUNING, "strength", 0, 2, 0.01);
    panel.add(BLOOM_TUNING, "radius", 0, 1, 0.01);
    panel.add(BLOOM_TUNING, "threshold", 0, 2, 0.01);
  }, [get]);

  useEffect(() => {
    return () => {
      pipelineRef.current?.pipeline.dispose();
      pipelineRef.current = null;
    };
  }, []);

  useFrame(() => {
    const { gl, scene, camera } = get();
    pipelineRef.current ??= createPipeline(asSceneRenderer(gl), scene, camera);
    const current = pipelineRef.current;

    // Applied per frame, as the other panels are; switching bloom off
    // rebuilds the output, so only on a change
    current.bloomPass.strength.value = BLOOM_TUNING.strength;
    current.bloomPass.radius.value = BLOOM_TUNING.radius;
    current.bloomPass.threshold.value = BLOOM_TUNING.threshold;
    if (BLOOM_TUNING.bloom !== current.withBloom) {
      current.pipeline.outputNode = current.outputFor(BLOOM_TUNING.bloom);
      current.pipeline.needsUpdate = true;
      current.withBloom = BLOOM_TUNING.bloom;
    }

    current.pipeline.render();
  }, RENDER_PRIORITY);

  return null;
}

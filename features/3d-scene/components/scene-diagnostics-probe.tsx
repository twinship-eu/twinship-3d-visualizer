"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Mesh, Texture, Vector2, type Material } from "three";
import { asSceneRenderer, isWebGPUBackend } from "../lib/webgpu-renderer";
import { SCENE_DIAGNOSTICS } from "../lib/scene-diagnostics";

/**
 * Delay before reading the scene, in ms.
 *
 * The environment probe is baked in an effect that renders the sky through
 * PMREMGenerator, so reading `scene.environment` on the same tick would report
 * a null that is merely early rather than wrong.
 */
const READ_DELAY_MS = 1500;

/** three's `Compatibility.TEXTURE_COMPARE` key; not re-exported from three/webgpu. */
const DEPTH_TEXTURE_COMPARE = "depthTextureCompare";

/** Materials to report. Enough to see a pattern without filling the screen. */
const MAX_MATERIALS_REPORTED = 5;

type InspectableMaterial = Material & {
  name?: string;
  map?: Texture | null;
  metalness?: number;
  roughness?: number;
  color?: { getHexString: () => string };
  envMapIntensity?: number;
};

/**
 * Describes one material in a single line.
 *
 * `map` answers whether the WebP textures decoded at all; metalness and
 * roughness answer whether the surface is a mirror; colour answers whether the
 * base is black before any lighting is applied.
 */
function describeMaterial(material: InspectableMaterial): string {
  const name = material.name || material.type;
  const hasMap = material.map ? "map" : "NOMAP";
  const image = material.map?.image as { width?: number } | undefined;
  const mapSize = image ? `${image.width ?? "?"}px` : "-";
  const metalness =
    typeof material.metalness === "number" ? material.metalness.toFixed(2) : "-";
  const roughness =
    typeof material.roughness === "number" ? material.roughness.toFixed(2) : "-";
  const color = material.color ? material.color.getHexString() : "-";
  const envIntensity =
    typeof material.envMapIntensity === "number"
      ? material.envMapIntensity.toFixed(2)
      : "-";

  return `${name} ${hasMap}/${mapSize} m${metalness} r${roughness} #${color} e${envIntensity}`;
}

/**
 * Reads renderer and scene state into SCENE_DIAGNOSTICS.
 *
 * Inside the Canvas, because that is where `useThree` reaches the renderer.
 * Renders nothing.
 */
export function SceneDiagnosticsProbe() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const timer = setTimeout(() => {
      const renderer = asSceneRenderer(gl);

      SCENE_DIAGNOSTICS.backend = isWebGPUBackend(gl) ? "WebGPU" : "WebGL2";
      SCENE_DIAGNOSTICS.hasEnvironment =
        scene.environment === null || scene.environment === undefined
          ? "NULL  <- metal renders black"
          : "set";
      SCENE_DIAGNOSTICS.shadowsEnabled = String(
        renderer.shadowMap?.enabled ?? "unknown"
      );

      try {
        SCENE_DIAGNOSTICS.depthCompare = String(
          renderer.hasCompatibility(DEPTH_TEXTURE_COMPARE)
        );
      } catch {
        SCENE_DIAGNOSTICS.depthCompare = "unavailable";
      }

      const environment = scene.environment;
      SCENE_DIAGNOSTICS.environmentIntensity = String(
        scene.environmentIntensity ?? "unset"
      );
      const environmentImage = environment?.image as
        | { width?: number; height?: number }
        | undefined;
      SCENE_DIAGNOSTICS.environmentSize = environmentImage
        ? `${environmentImage.width ?? "?"}x${environmentImage.height ?? "?"}`
        : "no image";
      SCENE_DIAGNOSTICS.toneMapping = `${renderer.toneMapping} @ ${renderer.toneMappingExposure}`;

      const seen = new Set<string>();
      const described: string[] = [];
      scene.traverse((object) => {
        if (described.length >= MAX_MATERIALS_REPORTED) return;
        const mesh = object as Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of list) {
          const line = describeMaterial(material as InspectableMaterial);
          if (seen.has(line) || described.length >= MAX_MATERIALS_REPORTED) continue;
          seen.add(line);
          described.push(line);
        }
      });
      SCENE_DIAGNOSTICS.materials = described;

      const size = renderer.getDrawingBufferSize(new Vector2());
      SCENE_DIAGNOSTICS.drawingBufferSize = `${Math.round(
        size.width
      )}x${Math.round(size.height)}`;
    }, READ_DELAY_MS);

    return () => clearTimeout(timer);
  }, [gl, scene]);

  return null;
}

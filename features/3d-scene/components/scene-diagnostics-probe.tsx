"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Mesh, Texture, Vector2, type Material } from "three";
import { asSceneRenderer, isWebGPUBackend } from "../lib/webgpu-renderer";
import {
  DIAGNOSTIC_ACTIONS,
  SCENE_DIAGNOSTICS,
  type DiagnosticPreset,
} from "../lib/scene-diagnostics";

/**
 * How often to re-read the scene, in ms.
 *
 * Read once at 1500ms and the ship is missing: the model is ~40 MB, and on a
 * phone it is still downloading. The first readout from a device reported only
 * the water and the loading ring for exactly that reason. Re-reading keeps the
 * panel current as the scene fills in.
 */
const READ_INTERVAL_MS = 2000;

/** three's `Compatibility.TEXTURE_COMPARE` key; not re-exported from three/webgpu. */
const DEPTH_TEXTURE_COMPARE = "depthTextureCompare";

/** Materials to report. Enough to see a pattern without filling the screen. */
const MAX_MATERIALS_REPORTED = 5;

type InspectableMaterial = Material & {
  name?: string;
  needsUpdate?: boolean;
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
function describeMaterial(
  material: InspectableMaterial,
  meshName: string
): string {
  const name = `${meshName || "?"}/${material.name || material.type}`;
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
    /** Original metalness and roughness, so `reset` is exact rather than a guess. */
    const originals = new Map<string, { m?: number; r?: number }>();
    const originalEnvIntensity = scene.environmentIntensity;

    DIAGNOSTIC_ACTIONS.apply = (preset: DiagnosticPreset) => {
      scene.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const entry of list) {
          const material = entry as InspectableMaterial;
          if (typeof material.metalness !== "number") continue;

          if (!originals.has(material.uuid)) {
            originals.set(material.uuid, {
              m: material.metalness,
              r: material.roughness,
            });
          }
          const original = originals.get(material.uuid);

          if (preset === "metal0") material.metalness = 0;
          if (preset === "rough0") material.roughness = 0;
          if (preset === "reset") {
            if (original?.m !== undefined) material.metalness = original.m;
            if (original?.r !== undefined) material.roughness = original.r;
          }
          material.needsUpdate = true;
        }
      });

      if (preset === "envUp") scene.environmentIntensity = 1;
      if (preset === "reset") scene.environmentIntensity = originalEnvIntensity;

      SCENE_DIAGNOSTICS.activePreset = preset;
    };

    return () => {
      DIAGNOSTIC_ACTIONS.apply = null;
    };
  }, [scene]);

  useEffect(() => {
    const read = () => {
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
      let meshCount = 0;
      scene.traverse((object) => {
        if ((object as Mesh).isMesh) meshCount += 1;
        if (described.length >= MAX_MATERIALS_REPORTED) return;
        const mesh = object as Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of list) {
          const line = describeMaterial(
            material as InspectableMaterial,
            mesh.name
          );
          if (seen.has(line) || described.length >= MAX_MATERIALS_REPORTED) continue;
          seen.add(line);
          described.push(line);
        }
      });
      SCENE_DIAGNOSTICS.materials = described;
      SCENE_DIAGNOSTICS.meshCount = String(meshCount);

      const size = renderer.getDrawingBufferSize(new Vector2());
      SCENE_DIAGNOSTICS.drawingBufferSize = `${Math.round(
        size.width
      )}x${Math.round(size.height)}`;
    };

    read();
    const timer = setInterval(read, READ_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [gl, scene]);

  return null;
}

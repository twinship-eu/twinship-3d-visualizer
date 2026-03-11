import { Grid } from "@react-three/drei";
import {
  getSceneScaleConfig,
  GRID_CELL_COLOR,
  GRID_FADE_STRENGTH,
  GRID_SECTION_COLOR,
  GROUND_PLANE_COLOR,
  GROUND_PLANE_OPACITY,
} from "../lib/3d-scene-config";
import { DoubleSide } from "three";

export function SceneGrid({ scale = 1 }: { scale?: number }) {
  const config = getSceneScaleConfig(scale);
  return (
    <group position={[0, -5, 0]}>
      {/* Solid ground plane (visible surface); renderOrder so it draws first in transparent pass */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[config.gridPlaneSize, config.gridPlaneSize]} />
        <meshStandardMaterial
          color={GROUND_PLANE_COLOR}
          fog={true}
          metalness={0.5}
          roughness={0.40}
          transparent
          opacity={GROUND_PLANE_OPACITY}
        />
      </mesh>
      {/* Grid lines on top (slightly above plane to avoid z-fighting) */}
      <Grid
        args={[config.gridPlaneSize, config.gridPlaneSize]}
        position={[0, 0.02, 0]}
        cellSize={config.gridCellSize}
        sectionSize={config.gridSectionSize}
        cellColor={GRID_CELL_COLOR}
        sectionColor={GRID_SECTION_COLOR}
        fadeDistance={config.gridFadeDistance}
        fadeStrength={GRID_FADE_STRENGTH}
        infiniteGrid={false}
        side={DoubleSide}
      />
    </group>
  );
}
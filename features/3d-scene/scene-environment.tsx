import { useThree } from "@react-three/fiber";
import {
  getSceneScaleConfig,
  SCENE_BACKGROUND_COLOR,
  SCENE_FOG_COLOR,
} from "./lib/3d-scene-config";
import { useEffect } from "react";
import { Color, Fog } from "three";

type Props = {
  scale?: number;
  /** When true, background is left null so the Sky mesh is visible. */
  useSkyBackground?: boolean;
};

export function SceneEnvironment({
  scale = 1,
  useSkyBackground = false,
}: Props) {
  const { scene } = useThree();
  const config = getSceneScaleConfig(scale);

  useEffect(() => {
    scene.background = useSkyBackground
      ? null
      : new Color(SCENE_BACKGROUND_COLOR);
    scene.fog = new Fog(
      SCENE_FOG_COLOR,
      config.fogNear,
      config.fogFar
    );
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, config.fogNear, config.fogFar, useSkyBackground]);

  return null;
}
import { createContext, useContext } from "react";

type SceneInteractionContextValue = {
  isOrbitControlsActive: boolean;
};

const SceneInteractionContext = createContext<SceneInteractionContextValue>({
  isOrbitControlsActive: false,
});

export function SceneInteractionProvider({
  value,
  children,
}: {
  value: SceneInteractionContextValue;
  children: React.ReactNode;
}) {
  return (
    <SceneInteractionContext.Provider value={value}>
      {children}
    </SceneInteractionContext.Provider>
  );
}

export function useSceneInteraction(): SceneInteractionContextValue {
  return useContext(SceneInteractionContext);
}


# Ship 3D model

The Ship Visualizer and the engine viewer both load `twinship-update2-ktx2.glb`,
`DEFAULT_SHIP_MODEL_PATH` in `features/ship-visualizer/ship-visualizer-config.ts`
(the engine viewer keeps only its `Engine` node). `twinship-update2.glb` is the
same model with WebP textures, loaded when `IS_KTX2_SHIP_TEXTURES_ENABLED` is
turned off, to compare.

## Updating the model

Both are build artifacts, not the master. They are built from the raw Blender
export `TwinShip_UPDATE 2.glb` (~229 MB): the propellers split out of the hull,
textures resized to 2K WebP and the geometry Meshopt-compressed, the engine and
the truck simplified, then the textures re-encoded as KTX2. The commands, and why
each step is there, are in the comment above `SHIP_MODEL_GLB` in
`ship-visualizer-config.ts`.

Meshopt is used rather than Draco because its decoder ships inside `three-stdlib`,
so the viewer needs no external decoder download at runtime. The KTX2 step needs
KTX-Software's `toktx` (see `scripts/encode-ship-textures-ktx2.sh`).

## Model requirements

- **Top-level nodes become the component tree.** The visualizer builds its
  side-nav from the scene's root nodes, so the export must keep them separate
  (`Base`, `Base_Top`, `ControlRoom`, `Engine`, `InflatableLifeRaft_Joined`,
  `New_Crane`, `Propellers`, `Radio_NEW`, `Truck`, `WindTurbines`). Never run
  `flatten`/`join` on it.
- **Node names drive the labels.** `FRIENDLY_LABELS` in `lib/3d-model.ts` maps
  node names to UI labels, and `lib/map-tree-to-sections.ts` maps those labels to
  sections. The cockpit refers to the nodes by name too (`COMPONENT_OBJECT_NAMES`
  in `features/cockpit/cockpit-systems.ts`, `objectName` in the callouts).
  Renaming a node in Blender means updating all of them.
- **Metallic materials need the scene IBL.** `SceneEnvironmentMap` bakes the sky
  into an environment probe; without it, metalness = 1 surfaces render black.

## What is tracked in git

Only the two builds. The raw exports (`TwinShip_UPDATE*.glb`,
`twinship-engine-raw*.glb`) are local art sources and gitignored: each is past
GitHub's 100 MB per-file limit. Earlier builds (V1, V2, the engine model,
UPDATE 1) are in git history.

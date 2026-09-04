# Ship 3D model

The Ship Visualizer loads `twinship-v3.glb`, referenced by `SHIP_MODEL_JOINED_GLB`
in `features/ship-visualizer/ship-visualizer-config.ts`.

## Updating the model

`twinship-v3.glb` is a build artifact, not the master. It is produced from the raw
Blender export in `TwinShip_Update/` by:

```bash
npm run optimize:ship-model
```

That script resizes the 4K textures to 2K, re-encodes them as WebP and compresses
the geometry with Meshopt, taking the file from ~170 MB to ~24 MB. Drop a new raw
export at `TwinShip_Update/TwinShip_Update.glb` and re-run it.

Meshopt is used rather than Draco because its decoder ships inside `three-stdlib`,
so the viewer needs no external decoder download at runtime.

## Model requirements

- **Top-level nodes become the component tree.** The visualizer builds its
  side-nav from the scene's root nodes, so the export must keep them separate
  (`Base`, `Base_Top`, `Container`, `ControlRoom`, `Crane`, `Engine`,
  `Propellers`, `Radio`, `WindTurbines`). Never run `flatten`/`join` on it.
- **Node names drive the labels.** `FRIENDLY_LABELS` in `lib/3d-model.ts` maps
  node names to UI labels, and `lib/map-tree-to-sections.ts` maps those labels to
  sections. Renaming a node in Blender means updating both.
- **Metallic materials need the scene IBL.** `SceneEnvironmentMap` bakes the sky
  into an environment probe; without it, metalness = 1 surfaces render black.

## What is tracked in git

Only the optimized build `twinship-v3.glb` and `twinship v2.glb`, the V1 model the
development-only variant toggle compares against. Everything else here is a local
art source and is gitignored, because together it runs past 350 MB:

- `TwinShip_Update/` — the raw Blender export plus `Maps_4_OUTPUT/`, the source PBR
  maps. The maps are already baked into the raw GLB, so the viewer never reads
  them. Needed only to re-run `npm run optimize:ship-model`, and to load the
  toggle's Raw option; without it that option 404s and the other two still work.
- `TwinShip.glb`, `TwinShipv12_Joined.glb` and the `.fbx` exports — superseded
  revisions, referenced by nothing in the app.

Ask whoever holds the art source for these if you need them; they are deliberately
absent from a fresh clone.

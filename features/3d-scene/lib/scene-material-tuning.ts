/**
 * Metalness applied to the ship's materials, as a scale on what the model
 * authored.
 *
 * The model ships almost fully metallic — 0.93 to 1.00 across the hull, deck
 * and towers, measured from its own metallic-roughness maps. Metal has no
 * diffuse response, so at 1.0 the hull can only ever reflect the environment
 * probe and reacts to nothing else. Easing it back gives the paint a little
 * diffuse response without flattening the genuinely metallic fittings.
 *
 * A scale rather than an absolute, so parts the model authored as dielectric —
 * containers, decals, the logo, all at 0 — stay at 0.
 *
 * The proper fix is in the source asset: the painted areas of the hull should
 * not be marked as bare metal in the first place. This compensates uniformly,
 * which is blunter than fixing the map.
 */
export const SHIP_METALNESS_SCALE = 0.85;

/**
 * Live material tuning, written by the Inspector's Lights panel and read by the
 * ship model each frame.
 *
 * A shared mutable rather than React state: it is driven by a GUI slider and
 * consumed inside the frame loop, and routing it through state would re-render
 * the scene on every drag. Same reasoning as LOADING_RING_REVEAL.
 */
export const SHIP_MATERIAL_TUNING = {
  /** Scales every ship material's metalness. See SHIP_METALNESS_SCALE. */
  metalnessScale: SHIP_METALNESS_SCALE,
};

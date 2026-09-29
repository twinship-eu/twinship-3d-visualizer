/**
 * How the 3D model's parts stand for the knowledge graph's components: the
 * one hand-written binding between the two. The rest — classes, values,
 * relations — is the graph's own, exported from the data pipeline by
 * `scripts/export-knowledge-graph.py` into `data/futuristic-vessel-kg.json`.
 */

/**
 * Each 3D part, by its label in the tree, and the knowledge graph's
 * instances it shows. The model is coarser than the graph: one "Engine" for
 * the two gensets. Parts not listed are not in the graph yet (the hull, the
 * control room, the deck equipment…): the viewer invents nothing for them.
 */
export const PART_INSTANCES: Record<string, string[]> = {
  Engine: ["FV-GN-1", "FV-GN-2"],
  Propellers: ["FV-CPP-1", "FV-CPP-2"],
  WAPS: ["FV-WASP-1", "FV-WASP-2"],
};

/** The ontology's documentation, where a class or property IRI opens its page. */
export const ONTOLOGY_PAGE_URL = "https://ontology.twin-ship.eu/index-en.html#";

/**
 * Types that qualify an instance rather than say what it is (AC, four-stroke,
 * bow…): passed over when naming it by its class.
 */
export const QUALIFYING_TYPES = new Set([
  "AC",
  "DC",
  "ESD",
  "FourStroke",
  "TwoStroke",
  "DieselElectricConfiguration",
  "Bow",
  "HotelLoad",
  "ShipServices",
  "RoRo",
]);

/**
 * The relations shown, in this order, as the ontology names them. An
 * incoming `ido:partOf` reads as its inverse, `hasPart`; the connections are
 * symmetric, stored both ways.
 */
export const RELATION_ORDER = ["partOf", "hasPart", "directlyConnectedTo", "connectedTo", "consume"] as const;

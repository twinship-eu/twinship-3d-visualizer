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
  // The graph has no hull of its own: the vessel is what the other systems are part of, and the hull stands for it
  "Base Hull": ["FV-RR-1"],
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

/**
 * Only the relations to a component the model has — one to click and jump to —
 * are shown. The rest are in the graph, and shown once the ship has a 3D part
 * for them: set this to false then.
 */
export const IS_ONLY_RELATIONS_TO_3D_PARTS = true;

/**
 * The viewer's route to the knowledge graph: GraphDB when it is set up, the
 * bundled export otherwise. Asked each time a part is selected.
 */
export const KNOWLEDGE_GRAPH_ROUTE = "/api/knowledge-graph";

/**
 * The data pipeline's GraphDB, server side, from the environment (see
 * .env.example): its address and the futuristic vessel's repository — fixed
 * here, never taken from the request, so no other vessel's repository is
 * reached — and, as GraphDB is behind Keycloak, a client's credentials.
 */
export const GRAPHDB_ENV = {
  URL: "GRAPHDB_URL",
  REPOSITORY: "GRAPHDB_REPOSITORY",
  TOKEN_URL: "GRAPHDB_TOKEN_URL",
  CLIENT_ID: "GRAPHDB_CLIENT_ID",
  CLIENT_SECRET: "GRAPHDB_CLIENT_SECRET",
} as const;
/** How long to wait for Keycloak or GraphDB, in ms, before the bundled export is shown. */
export const GRAPHDB_TIMEOUT_MS = 8000;
/**
 * The graph read from GraphDB is kept on the server, as it changes only when
 * the pipeline runs: for this long, in ms, it is shown as it is. After it, the
 * next selection still gets it at once, and GraphDB is read again for the
 * ones after.
 */
export const GRAPHDB_FRESH_MS = 60_000;
/**
 * The oldest graph shown while GraphDB is read again, in ms. Older — GraphDB
 * has not answered for that long — the selection waits for GraphDB, and gets
 * the bundled export if it still does not answer.
 */
export const GRAPHDB_MAX_STALE_MS = 5 * 60_000;
/** Where the pipeline names the vessels' instances. */
export const INDIVIDUALS_NAMESPACE = "https://twin-ship.eu/individuals/";

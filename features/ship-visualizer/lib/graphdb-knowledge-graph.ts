import {
  GRAPHDB_ENV,
  GRAPHDB_FRESH_MS,
  GRAPHDB_MAX_STALE_MS,
  GRAPHDB_TIMEOUT_MS,
  INDIVIDUALS_NAMESPACE,
} from "../ship-knowledge-graph-config";
import type { KnowledgeGraph, KnowledgeGraphInstance } from "./knowledge-graph";

/**
 * The knowledge graph read from the data pipeline's GraphDB, server side:
 * the vessel's instances, values and relations, and the ontology's labels and
 * definitions of their classes and properties — the same shape
 * `scripts/export-knowledge-graph.py` exports, built the same way.
 */

const TWINSHIP = "https://twin-ship.eu/twinship#";
const IDO = "http://rds.posccaesar.org/ontology/lis14/rdl/";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
/** The ontology's definition of an individual: a description, not one of its values. */
const RDFS_COMMENT = "http://www.w3.org/2000/01/rdf-schema#comment";
const PAV = "http://purl.org/pav/";
/** OWL's bookkeeping, not a class the viewer names an instance by. */
const NAMED_INDIVIDUAL = "http://www.w3.org/2002/07/owl#NamedIndividual";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const NUMERIC_TYPES = new Set(["integer", "int", "long", "short", "decimal", "double", "float"].map((type) => XSD + type));
/**
 * GraphDB's stored facts only. Its reasoning also answers what the ontology
 * implies — every `directlyConnectedTo` again as `connectedTo` — which would
 * list those connections twice.
 */
const EXPLICIT_GRAPH = "http://www.ontotext.com/explicit";

type Term = { type: "uri" | "literal" | "bnode"; value: string; datatype?: string; "xml:lang"?: string };
type SparqlResults = { results: { bindings: Record<string, Term | undefined>[] } };

type Subject = { types: string[]; labels: string[]; values: [string, string | number | boolean][] };

/**
 * An instance's name: the ontology's label where it has one besides the
 * pipeline's (Ammonia, not AMM), else the pipeline's, else its identifier.
 */
function labelOf(identifier: string, labels: string[]) {
  return [...labels].sort().find((label) => label !== identifier) ?? labels[0] ?? identifier;
}

type GraphDBConfig = { endpoint: string; repository: string; tokenUrl?: string; clientId?: string; clientSecret?: string };

/** GraphDB's settings from the environment; null when it is not set up. */
function graphDBConfig(): GraphDBConfig | null {
  const url = process.env[GRAPHDB_ENV.URL];
  const repository = process.env[GRAPHDB_ENV.REPOSITORY];
  if (!url || !repository) return null;
  return {
    endpoint: `${url.replace(/\/+$/, "")}/repositories/${encodeURIComponent(repository)}`,
    repository,
    tokenUrl: process.env[GRAPHDB_ENV.TOKEN_URL],
    clientId: process.env[GRAPHDB_ENV.CLIENT_ID],
    clientSecret: process.env[GRAPHDB_ENV.CLIENT_SECRET],
  };
}

export const isGraphDBConfigured = () => graphDBConfig() !== null;

/** Keycloak's token, kept until shortly before it expires. */
let token: { value: string; expiresAt: number } | null = null;

async function bearerToken({ tokenUrl, clientId, clientSecret }: GraphDBConfig): Promise<string | null> {
  if (!tokenUrl || !clientId || !clientSecret) return null;
  if (token && token.expiresAt > Date.now()) return token.value;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(GRAPHDB_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Keycloak refused the client's credentials (${response.status})`);
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Keycloak answered without a token");
  // A margin, so a token is not sent as it expires
  token = { value: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 60) - 30) * 1000 };
  return token.value;
}

/** How many of a query's answers the server log shows. */
const LOGGED_ROWS = 5;

/** One answer as the log shows it: each variable's value, without SPARQL's wrapping. */
const loggedRow = (row: Record<string, Term | undefined>) =>
  Object.fromEntries(Object.entries(row).map(([name, term]) => [name, term?.value]));

async function select(config: GraphDBConfig, name: string, query: string) {
  const bearer = await bearerToken(config);
  const startedAt = Date.now();
  console.info(`[knowledge-graph] GraphDB ${name} query → ${config.endpoint}\n${query.trim()}`);
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: new URLSearchParams({ query }),
    signal: AbortSignal.timeout(GRAPHDB_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    console.warn(`[knowledge-graph] GraphDB ${name} query answered ${response.status} in ${Date.now() - startedAt} ms`);
    throw new Error(`GraphDB answered ${response.status} for ${config.repository}`);
  }
  const rows = ((await response.json()) as SparqlResults).results.bindings;
  console.info(
    `[knowledge-graph] GraphDB ${name} query answered ${rows.length} rows in ${Date.now() - startedAt} ms; the first ${Math.min(rows.length, LOGGED_ROWS)}:`,
    rows.slice(0, LOGGED_ROWS).map(loggedRow)
  );
  return rows;
}

/**
 * Every stored fact about the vessel's instances, and about what they point
 * to that the ontology defines as an individual: the fuels the engines
 * consume (tws:AMM, tws:BF). Provenance (PAV) is left out, as in the export.
 */
const VESSEL_QUERY = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT DISTINCT ?s ?p ?o FROM <${EXPLICIT_GRAPH}> WHERE {
  {
    ?s ?p ?o .
    FILTER(STRSTARTS(STR(?s), "${INDIVIDUALS_NAMESPACE}"))
  } UNION {
    ?instance ?link ?s .
    ?s ?p ?o .
    FILTER(STRSTARTS(STR(?instance), "${INDIVIDUALS_NAMESPACE}") && ?link != rdf:type && isIRI(?s))
  }
  FILTER(!STRSTARTS(STR(?p), "${PAV}"))
}`;

/** The ontology's label and definition of each term, in English or untagged. */
const termsQuery = (iris: string[]) => `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?term ?label ?comment FROM <${EXPLICIT_GRAPH}> WHERE {
  VALUES ?term { ${iris.map((iri) => `<${iri}>`).join(" ")} }
  OPTIONAL { ?term rdfs:label ?label FILTER(LANG(?label) IN ("", "en")) }
  OPTIONAL { ?term rdfs:comment ?comment FILTER(LANG(?comment) IN ("", "en")) }
}`;

const localName = (iri: string) => iri.split("#").pop()?.split("/").pop() ?? iri;

/** A predicate as the ontology writes it: tws:consume, ido:connectedTo. */
function prefixed(iri: string) {
  if (iri.startsWith(TWINSHIP)) return `tws:${iri.slice(TWINSHIP.length)}`;
  if (iri.startsWith(IDO)) return `ido:${iri.slice(IDO.length)}`;
  return iri;
}

function literalValue({ value, datatype }: Term): string | number | boolean {
  if (datatype && NUMERIC_TYPES.has(datatype)) return Number(value);
  if (datatype === `${XSD}boolean`) return value === "true" || value === "1";
  return value;
}

const byName = <T>(entries: [string, T][]) => Object.fromEntries(entries.sort(([first], [second]) => (first < second ? -1 : first > second ? 1 : 0)));

/** The futuristic vessel's knowledge graph from GraphDB; null when GraphDB is not set up. Throws when it does not answer. */
export async function readGraphDBKnowledgeGraph(): Promise<KnowledgeGraph | null> {
  const config = graphDBConfig();
  if (!config) return null;

  const facts = await select(config, "vessel facts", VESSEL_QUERY);
  const bySubject = new Map<string, Subject>();
  const relations: KnowledgeGraph["relations"] = [];
  const classIris = new Set<string>();
  const propertyIris = new Set<string>();
  const subjectOf = (iri: string) => {
    let subject = bySubject.get(iri);
    if (!subject) bySubject.set(iri, (subject = { types: [], labels: [], values: [] }));
    return subject;
  };

  for (const { s, p, o } of facts) {
    if (!s || !p || !o || s.type !== "uri") continue;
    const subject = subjectOf(s.value);
    if (p.value === RDF_TYPE) {
      if (o.value === NAMED_INDIVIDUAL) continue;
      subject.types.push(localName(o.value));
      classIris.add(o.value);
    } else if (o.type === "literal") {
      if (p.value === RDFS_LABEL) subject.labels.push(o.value);
      else if (p.value !== RDFS_COMMENT) {
        subject.values.push([localName(p.value), literalValue(o)]);
        propertyIris.add(p.value);
      }
    } else if (o.type === "uri") {
      relations.push({ subject: localName(s.value), predicate: prefixed(p.value), object: localName(o.value) });
    }
  }

  // Only what has a class is an instance, as in the export
  const instances: Record<string, KnowledgeGraphInstance> = byName(
    [...bySubject.entries()]
      .filter(([, subject]) => subject.types.length > 0)
      .map(([iri, subject]) => [
        localName(iri),
        { label: labelOf(localName(iri), subject.labels), types: [...subject.types].sort(), values: byName(subject.values) },
      ])
  );

  const terms = classIris.size + propertyIris.size > 0 ? await select(config, "ontology terms", termsQuery([...classIris, ...propertyIris])) : [];
  const described = new Map<string, { iri: string; label: string | null; comment: string | null }>();
  for (const { term, label, comment } of terms) {
    if (!term) continue;
    const known = described.get(term.value);
    described.set(term.value, { iri: term.value, label: known?.label ?? label?.value ?? null, comment: known?.comment ?? comment?.value ?? null });
  }
  const describe = (iris: Set<string>) =>
    byName([...iris].map((iri) => [localName(iri), described.get(iri) ?? { iri, label: null, comment: null }]));

  console.info(
    `[knowledge-graph] Built from GraphDB: ${Object.keys(instances).length} instances, ${relations.length} relations, ${classIris.size} classes, ${propertyIris.size} properties`
  );
  return {
    source: {
      pipeline: "twinship-data-pipeline",
      commit: null,
      workbook: `GraphDB repository ${config.repository}`,
      exportedAt: new Date().toISOString(),
      unknownValue: -1,
    },
    instances,
    relations: relations.sort((first, second) =>
      `${first.subject}|${first.predicate}|${first.object}` < `${second.subject}|${second.predicate}|${second.object}` ? -1 : 1
    ),
    classes: describe(classIris),
    properties: describe(propertyIris),
  };
}

/** The last graph GraphDB answered, and when. */
let kept: { graph: KnowledgeGraph; readAt: number } | null = null;
/** The read under way: requests arriving meanwhile share it. */
let reading: Promise<KnowledgeGraph | null> | null = null;

function readAndKeep(): Promise<KnowledgeGraph | null> {
  reading ??= readGraphDBKnowledgeGraph()
    .then((graph) => {
      kept = graph ? { graph, readAt: Date.now() } : null;
      return graph;
    })
    .finally(() => {
      reading = null;
    });
  return reading;
}

/**
 * The knowledge graph from GraphDB, read at most once per GRAPHDB_FRESH_MS
 * however many parts are selected; null when GraphDB is not set up. A graph
 * past that age is still returned while it is read again in the background,
 * up to GRAPHDB_MAX_STALE_MS. Throws when GraphDB does not answer and no
 * graph that recent is kept.
 */
export async function cachedGraphDBKnowledgeGraph(): Promise<KnowledgeGraph | null> {
  const age = kept ? Date.now() - kept.readAt : Infinity;
  if (kept && age < GRAPHDB_FRESH_MS) {
    console.info(`[knowledge-graph] GraphDB graph kept from ${Math.round(age / 1000)} s ago`);
    return kept.graph;
  }
  if (kept && age < GRAPHDB_MAX_STALE_MS) {
    console.info(`[knowledge-graph] GraphDB graph kept from ${Math.round(age / 1000)} s ago; reading it again`);
    readAndKeep().catch((error) => console.warn("[knowledge-graph] GraphDB did not answer the refresh; the kept graph is shown.", error));
    return kept.graph;
  }
  return readAndKeep();
}

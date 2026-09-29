"""Exports the futuristic vessel's knowledge graph for the 3D viewer.

The viewer's Ontology screen shows what the knowledge graph says of each
component: its class, its values, its relations. They come from here — the
data pipeline's own extraction and harmonisation run on its KG workbook —
not from hand-written lists, so what the viewer shows is what the graph holds.

Usage:
  python scripts/export-knowledge-graph.py <twinship-data-pipeline> [output.json]

Needs the pipeline's data libraries (pandas, openpyxl, rdflib), not Dagster:
the pipeline package's __init__ (which loads Dagster) is bypassed.
Output defaults to features/ship-visualizer/data/futuristic-vessel-kg.json.
"""

import json
import subprocess
import sys
import types
from datetime import datetime, timezone
from pathlib import Path

WORKBOOK = "data/RoRo Futuristic Vessel KG Working File.xlsx"
ONTOLOGY_FILES = ["ontology/twinship-base.ttl", "ontology/twinship-core.ttl", "ontology/modules/vessel.ttl"]
TWINSHIP = "https://twin-ship.eu/twinship#"
IDO = "http://rds.posccaesar.org/ontology/lis14/rdl/"
# Provenance, not structure: left out
SKIPPED_PREDICATES = {"createdBy", "createdOn"}
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "features" / "ship-visualizer" / "data" / "futuristic-vessel-kg.json"


def load_pipeline(pipeline: Path):
    """The pipeline's extraction and harmonisation, imported without its Dagster definitions."""
    sys.path.insert(0, str(pipeline))
    package = types.ModuleType("dagster_pipeline")
    package.__path__ = [str(pipeline / "dagster_pipeline")]
    sys.modules["dagster_pipeline"] = package
    from dagster_pipeline.futuristic_extraction import (
        discover_futuristic_vessels,
        extract_futuristic_vessel,
        load_futuristic_sheets,
    )
    from twinship_harmonisation.high_level import harmonise_twinship_vessel

    return load_futuristic_sheets, discover_futuristic_vessels, extract_futuristic_vessel, harmonise_twinship_vessel


def build_graph(pipeline: Path):
    load_sheets, discover, extract, harmonise = load_pipeline(pipeline)
    sheets = load_sheets(str(pipeline / WORKBOOK))
    vessels = discover(sheets)
    if len(vessels) != 1:
        raise SystemExit(f"{WORKBOOK}: expected one futuristic vessel, found {list(vessels)}")
    (namespace, vessel), = vessels.items()
    return harmonise(**extract(sheets, vessel["prefix"], namespace))


def local_name(uri) -> str:
    text = str(uri)
    return text.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def prefixed(uri) -> str:
    """A predicate as the ontology writes it: tws:consume, ido:connectedTo."""
    text = str(uri)
    for prefix, base in (("tws", TWINSHIP), ("ido", IDO)):
        if text.startswith(base):
            return f"{prefix}:{text[len(base):]}"
    return text


def literal_value(literal):
    value = literal.toPython()
    return value if isinstance(value, (int, float, bool)) else str(value)


def describe(ontology, uris):
    """Labels and comments from the ontology, by local name."""
    from rdflib import RDFS, URIRef

    described = {}
    for uri in sorted(uris, key=str):
        label = ontology.value(URIRef(uri), RDFS.label)
        comment = ontology.value(URIRef(uri), RDFS.comment)
        described[local_name(uri)] = {
            "iri": str(uri),
            "label": str(label) if label else None,
            "comment": str(comment) if comment else None,
        }
    return described


def export(pipeline: Path, output: Path):
    from rdflib import RDF, RDFS, Graph, Literal, URIRef

    graph = build_graph(pipeline)
    ontology = Graph()
    for path in ONTOLOGY_FILES:
        ontology.parse(pipeline / path, format="turtle")

    instances, relations, classes, properties = {}, [], set(), set()
    for subject in sorted(set(graph.subjects(RDF.type, None)), key=str):
        identifier = local_name(subject)
        instance_types = sorted(local_name(t) for t in graph.objects(subject, RDF.type))
        classes.update(str(t) for t in graph.objects(subject, RDF.type))
        values = {}
        for predicate, obj in graph.predicate_objects(subject):
            name = local_name(predicate)
            if name in SKIPPED_PREDICATES or predicate == RDF.type:
                continue
            if isinstance(obj, Literal):
                if predicate == RDFS.label:
                    continue
                values[name] = literal_value(obj)
                properties.add(str(predicate))
            elif isinstance(obj, URIRef):
                relations.append({"subject": identifier, "predicate": prefixed(predicate), "object": local_name(obj)})
        label = graph.value(subject, RDFS.label)
        instances[identifier] = {
            "label": str(label) if label else identifier,
            "types": instance_types,
            "values": dict(sorted(values.items())),
        }

    try:
        commit = subprocess.run(["git", "-C", str(pipeline), "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        commit = None

    exported = {
        "source": {
            "pipeline": "twinship-data-pipeline",
            "commit": commit,
            "workbook": WORKBOOK,
            "exportedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "unknownValue": -1,
        },
        "instances": instances,
        "relations": sorted(relations, key=lambda r: (r["subject"], r["predicate"], r["object"])),
        "classes": describe(ontology, classes),
        "properties": describe(ontology, properties),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(exported, indent=1, ensure_ascii=False) + "\n")
    print(f"{output}: {len(instances)} instances, {len(relations)} relations, commit {commit}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    export(Path(sys.argv[1]).resolve(), Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT)

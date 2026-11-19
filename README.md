# TwinShip 3D Viewer

An **ontology-based 3D viewer** for the TwinShip futuristic RoRo vessel. Explore the ship’s structure in an interactive 3D scene, browse components via an ontology-aligned tree, and open semantic links to the [TwinShip ontology](https://ontology.twin-ship.eu/) for definitions, parameters, and relationships.

---

## Features

### Ontology Explorer (left panel)

- **Hierarchical tree** of ship components, driven by the loaded 3D model or a fallback mock tree. Sections follow ontology-aligned categories: Hull, Superstructure, Deck equipment, Propeller system, Energy system, Wind assisted propulsion system.
- **Search** — Filter the tree by component name (e.g. “Engine”, “Propellers”, “Wind Towers”).
- **Visibility toggles** — Show or hide whole sections in the 3D view.
- **Selection** — Click a component in the tree to select it in the scene; the camera focuses on the part and a details panel opens.
- **Skeleton state** — While the ship model is loading, the explorer shows a skeleton UI instead of the tree.

### 3D ship visualization

- **GLB model** — Renders the TwinShip vessel from a single GLB file (default: `public/ship/twinship v2.glb`). The scene includes sky, water, and basic floating animation.
- **Orbit controls** — Rotate, zoom, and pan. Zoom controls are also available as on-screen buttons.
- **Selection & hover** — Click or select from the tree to highlight a part; hover for feedback. Selected part uses a distinct color; unselected parts dim; hovered part is emphasized.
- **Camera** — Smooth transitions when selecting a component or resetting the view.
- **Sections** — Model mesh names are mapped into ontology sections (e.g. Hull, Propeller system) so the tree and 3D selection stay in sync.

### Selection details & ontology links

When you select a component, a **details modal** shows:

- **Title** — Component name. For ontology-backed components (e.g. Propellers, Engine, Wind Towers), the title is a **link to the TwinShip ontology** (`https://ontology.twin-ship.eu/`), e.g.:
  - [PropellerSystem](https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#PropellerSystem)
  - [MainEngineSystem](https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#MainEngineSystem)
  - [WindAssistedPropulsionSystem](https://ontology.twin-ship.eu/index-en.html#https://twin-ship.eu/twinship#WindAssistedPropulsionSystem)
- **Description** — Short text for the component.
- **Parameters** — Name/value list. Many parameter names are **linked to ontology properties** (same base URL with fragment IDs such as `#twPropellerBlades`, `#twShaftPowerMaxInKW`, `#twWASPPowerInKW`), so users can jump from the viewer to the formal definition.
- **Connected components** — Ontology-aligned relationships (e.g. Base Hull ↔ Hull top towers, Control room, Wind Towers, Engine; Engine ↔ Propellers, Wind Towers, Base Hull). Clicking a connected component in the modal selects that component in the tree and 3D view.

So the app both **uses** the ontology (structure, parameters, relationships) and **links out** to it for deeper inspection.

---

## Ontology integration

The viewer is built around the **TwinShip ontology** and keeps strong ties to it:

| What | How |
|------|-----|
| **Ontology base** | [https://ontology.twin-ship.eu/](https://ontology.twin-ship.eu/) (English index: `index-en.html`) |
| **Component classes** | Component titles and details link to ontology classes (e.g. `PropellerSystem`, `MainEngineSystem`, `WindAssistedPropulsionSystem`) via `#https://twin-ship.eu/twinship#<ClassName>`. |
| **Parameters** | Parameter names in the details modal link to ontology properties (e.g. `twPropellerBlades`, `twShaftPowerMaxInKW`, `twWASPPowerInKW`, `twWASPPowerReductionEfficiencyPercentage`). |
| **Structure** | The explorer tree is organized into sections that match ontology-related domains: Hull, Superstructure, Deck equipment, Propeller system, Energy system, Wind assisted propulsion system. |
| **Relationships** | “Connected components” and the relations strip come from the knowledge graph (`ido:partOf`, `ido:connectedTo`, `ido:directlyConnectedTo`, `tws:consume`), so navigation between related parts reflects it. |

A component's class, description, parameters and relations come from the **knowledge graph** (below), not from hand-written lists. A link is the ontology's page plus the term's IRI as the fragment, `ONTOLOGY_PAGE_URL` + `https://twin-ship.eu/twinship#twShaftPowerMaxInKW`: the page's anchors are the full IRIs, so every term the graph returns links without a mapping (the IDO terms too). An IRI opened on its own does not resolve: twin-ship.eu has no page for it.

The one hand-written binding is `PART_INSTANCES` in `features/ship-visualizer/ship-knowledge-graph-config.ts`: which 3D part shows which of the graph's instances (Engine → `FV-GN-1`, `FV-GN-2`). The graph knows nothing of the 3D model.

### Knowledge graph: GraphDB, or the bundled export

When a part is selected, its screens ask `/api/knowledge-graph`, and say where the answer came from:

- **GraphDB** (*queried from GraphDB*): the route reads the futuristic vessel's repository in the [data pipeline](https://github.com/twinship-eu/twinship-data-pipeline)'s GraphDB with SPARQL, server side (`features/ship-visualizer/lib/graphdb-knowledge-graph.ts`). Only stored facts are read: GraphDB's reasoning would also return every `directlyConnectedTo` again as `connectedTo`. The graph is kept on the server and read again at most once a minute (`GRAPHDB_FRESH_MS`), however many parts are selected: past that minute, the next selection still gets the kept graph at once while GraphDB is read again in the background. A graph older than five minutes (`GRAPHDB_MAX_STALE_MS`, GraphDB not answering meanwhile) is no longer shown: the selection waits for GraphDB, then falls back to the bundled export. Each query, its row count and its first rows are logged under `[knowledge-graph]`.
- **The bundled export** (*from the bundled knowledge graph export*): `features/ship-visualizer/data/futuristic-vessel-kg.json`, written by `scripts/export-knowledge-graph.py` from the same pipeline. Used, quietly, when GraphDB is not set up, does not answer, or refuses the login; the route logs a warning.

GraphDB is set up with these variables in `.env.local` (server side only, see `.env.example`):

| Variable | What |
|----------|------|
| `GRAPHDB_URL` | GraphDB's address, e.g. `http://localhost:7200` |
| `GRAPHDB_REPOSITORY` | The futuristic vessel's repository, `futuristic-vessel`. Fixed here, never taken from the request: the same GraphDB holds the other vessels' repositories, which the viewer must not reach. |
| `GRAPHDB_TOKEN_URL` | Keycloak's token endpoint, as GraphDB is behind it: `http://keycloak:8080/realms/twinship/protocol/openid-connect/token` locally |
| `GRAPHDB_CLIENT_ID`, `GRAPHDB_CLIENT_SECRET` | A Keycloak client's credentials (client credentials grant) |

Without `GRAPHDB_URL` and `GRAPHDB_REPOSITORY`, the bundled export is shown. Without the three Keycloak variables, GraphDB is asked without a token.

**Running GraphDB locally**, from the data pipeline's repository:

```bash
# Once: the browser and the viewer reach Keycloak by its Docker name
echo "127.0.0.1 keycloak" | sudo tee -a /etc/hosts

docker compose up -d --build
```

This starts GraphDB (http://localhost:7200), Keycloak, and Dagster, whose sensor runs the pipeline and uploads each vessel to its repository (`futuristic-vessel` for this one). Locally, the pipeline's own Keycloak client serves the viewer too: `GRAPHDB_CLIENT_ID=dagster-pipeline`, `GRAPHDB_CLIENT_SECRET` set to the pipeline's `KEYCLOAK_CLIENT_SECRET` (`local-dev-dagster-client-secret` when its `.env` does not set one). A deployment needs its own client for the viewer, with its secret kept out of the repository.

---

## Tech stack

- **Framework:** [Next.js](https://nextjs.org) (App Router) with [React](https://react.dev) 19
- **3D:** [Three.js](https://threejs.org), [React Three Fiber](https://docs.pmnd.rs/react-three-fiber), [@react-three/drei](https://github.com/pmndrs/drei) (orbit controls, `useGLTF`, etc.)
- **UI:** [Tailwind CSS](https://tailwindcss.com), [Lucide React](https://lucide.dev) icons
- **Code quality:** TypeScript, ESLint, Prettier (see [AGENTS.md](AGENTS.md) and `.cursor/rules` for conventions)

The 3D canvas runs only on the client (no SSR of the WebGL/WebGPU scene).

---

## Project structure

```
├── app/
│   ├── layout.tsx          # Root layout, metadata ("TwinShip 3D Viewer")
│   ├── page.tsx             # Main page: renders ShipVisualizer
│   └── globals.css
├── components/
│   └── ui/                  # Shared UI (e.g. Input)
├── Dockerfile               # Multi-stage build for production image
├── .dockerignore             # Excludes dev files from Docker build context
├── features/
│   ├── 3d-scene/            # Canvas, lights, sky, water, orbit controls, zoom overlay
│   ├── ontology-explorrer/  # Left-panel tree (Ontology Explorer), search, TreeNode, skeleton
│   └── ship-visualizer/    # Main feature: Scene + OntologyExplorer, model loading,
│       │                    # section mapping, selection, SelectionDetailsModal
│       ├── ship-visualizer-config.ts   # Layout, colors, paths, sections, camera
│       ├── ship-visualizer-types.ts     # ShipTreeNode
│       ├── selection-details.ts        # Ontology-backed details & links per component
│       ├── lib/                        # filter-tree, map-tree-to-sections, etc.
│       └── components/                 # GLB model, scene content, modal, search, etc.
├── lib/
│   └── utils.ts             # cn() etc.
├── public/
│   └── ship/                # Ship model (GLB), texture, README
└── README.md
```

The **ontology explorer** and **ship visualizer** are separate features; the visualizer composes the explorer and the 3D scene and wires selection and visibility between them.

---

## Getting started

### Prerequisites

- Node.js (version aligned with the project’s engines, e.g. 18+)
- npm (or yarn/pnpm/bun)

### Install and run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the Ontology Explorer on the left and the 3D ship on the right.

### Ship model

Place the TwinShip GLB model in `public/ship/`. Default path is `/ship/twinship v2.glb` (see `ship-visualizer-config.ts`). If the file is missing, the app shows an error with instructions. Optional texture: `public/ship/Atlas_Twinship.png`.

See `public/ship/README.md` for asset notes.

---

## Configuration

Main constants live in **`features/ship-visualizer/ship-visualizer-config.ts`**:

- **Layout:** max left panel width
- **Model & texture:** default GLB path, texture path
- **Colors:** ship color, selected part color
- **Opacity:** unselected and hovered part opacity when another part is selected
- **Camera:** default position, target, transition duration
- **Animation:** floating (bob, pitch, roll), interaction Y offset, transition and idle reset
- **Sections:** `SHIP_TREE_SECTIONS` (Hull, Superstructure, Deck equipment, Propeller system, Energy system, Wind assisted propulsion system), plus `NON_SELECTABLE_SECTION_IDS` (e.g. deck)

The knowledge graph's settings live in **`features/ship-visualizer/ship-knowledge-graph-config.ts`**: `PART_INSTANCES`, `ONTOLOGY_PAGE_URL` (the ontology's page, `https://ontology.twin-ship.eu/index-en.html#`), the GraphDB variables' names and its timeout.

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |

See [AGENTS.md](AGENTS.md) for formatting and rules (e.g. `npm run format`, `npm run sync:claude-rules`).

---

## Docker

The app can be built and run as a Docker image. The Dockerfile uses a multi-stage build: it builds the Next.js app with `output: "standalone"`, then runs the standalone server in a minimal Node Alpine image.

### Build the image

From the project root:

```bash
docker build -t twinship-3d-viewer .
```

Use a specific tag if you prefer, e.g. `docker build -t twinship-3d-viewer:1.0.0 .`

### Run the container

```bash
docker run -p 3000:3000 twinship-3d-viewer
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

**Options:**

- **Custom port (host):** map another host port to 3000, e.g. `docker run -p 8080:3000 twinship-3d-viewer`, then open `http://localhost:8080`.
- **Run in background:** `docker run -d -p 3000:3000 --name twinship twinship-3d-viewer`. Stop with `docker stop twinship`, remove with `docker rm twinship`.

### Quick test (build + run)

```bash
# Build
docker build -t twinship-3d-viewer .

# Run (foreground)
docker run -p 3000:3000 twinship-3d-viewer
```

In another terminal you can confirm the app is up, e.g. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` (expect `200`).

### Ship model and assets

The image includes whatever is in `public/` at build time (including `public/ship/`). To use your own GLB or texture, either:

- Put the files in `public/ship/` and rebuild the image, or  
- Mount a volume when running, e.g. `docker run -p 3000:3000 -v /path/to/your/ship:/app/public/ship twinship-3d-viewer`.

---

## Deployment

You can deploy the TwinShip 3D Viewer in several ways:

### Deploy with Docker

1. **Build** the image on the target host or in your CI:  
   `docker build -t twinship-3d-viewer .`
2. **Run** the container, mapping port 3000 to a host port:  
   `docker run -d -p 3000:3000 --name twinship twinship-3d-viewer`
3. Put a **reverse proxy** (e.g. Nginx, Caddy, Traefik) in front of the container and terminate TLS if needed. The app listens on `0.0.0.0:3000` inside the container.

For production, use a process manager or orchestrator (e.g. Docker Compose, Kubernetes) and ensure the ship assets in `public/ship/` are present in the image or mounted as above.

### Linking the app to a specific domain (HTTPS)

The image does **not** handle the domain or HTTPS by itself. To serve the app at a domain (e.g. `viewer.yourcompany.com`):

1. **Run the container** (on your server or in your cluster), e.g. mapping host port `3000` to container port `3000`.
2. **Point DNS** for your domain to the server’s public IP (or to your load balancer).
3. **Put a reverse proxy in front** of the container so it:
   - Listens on port 80/443 for your domain.
   - Terminates HTTPS (e.g. with Let’s Encrypt / certbot, or your platform’s TLS).
   - Proxies requests to `http://localhost:3000` (or to the container’s network address, e.g. `http://twinship:3000` in Docker Compose).

**Example (Caddy)** — Caddy can obtain and renew TLS automatically:

```text
viewer.yourcompany.com {
  reverse_proxy localhost:3000
}
```

**Example (Nginx)** — you’d configure a `server` block for your domain, SSL certificate paths, and `proxy_pass http://localhost:3000;`.

Once the proxy and DNS are in place, users open `https://viewer.yourcompany.com` and the proxy forwards traffic to the container. The Next.js app does not need to know the domain; it works with relative URLs.

### Deploy without Docker

You can also deploy the Next.js app to any platform that supports Node (e.g. [Vercel](https://vercel.com)). Ensure the chosen Node version matches the project. The app is client-heavy (3D); ensure the deployment serves static assets under `public/` (e.g. `public/ship/`) so the GLB and texture load correctly.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Learn more

- [Next.js documentation](https://nextjs.org/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) and [Drei](https://github.com/pmndrs/drei)
- [TwinShip ontology](https://ontology.twin-ship.eu/) — formal definitions and properties for ship components
- Project conventions and AI guidelines: [AGENTS.md](AGENTS.md) and [.cursor/rules/](.cursor/rules/)
- Ship visualizer technical notes: `features/ship-visualizer/SHIP-VISUALIZER-TECHNICAL-DESCRIPTION.md`

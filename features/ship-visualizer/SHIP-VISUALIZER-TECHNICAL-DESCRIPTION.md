# Ship Visualizer — Technical Description

## 1. Libraries and Technologies

The Ship Visualizer is built with the following core libraries:

- **Three.js (v0.182)** — Industry-standard 3D engine for the web. It provides the low-level rendering API, scene graph, loaders (e.g. GLB/GLTF), materials, lights, and camera controls. Three.js supports both WebGL and WebGPU backends.

- **React Three Fiber (R3F)** — A React renderer for Three.js. It allows building 3D scenes with React components and hooks instead of imperative code, and integrates with the React lifecycle and state.

- **@react-three/drei** — A companion library to React Three Fiber that provides ready-made helpers: orbit controls (rotate, zoom, pan), environment maps, and loaders (e.g. `useGLTF` for GLB models). This reduces custom code and keeps the implementation maintainable.

The application framework is **Next.js** with **React 19**, and the 3D canvas is loaded on the client only (no server-side rendering of the 3D view) to avoid issues with WebGL/WebGPU and to improve initial load.

---

## 2. Recommended Approach

The chosen approach is **declarative, component-based 3D**:

- **Single responsibility** — The 3D scene is isolated in a dedicated component; the rest of the UI (e.g. search panel, data tree) stays in standard React/DOM.

- **Reuse of the React ecosystem** — State, routing, and UI patterns are shared with the rest of the application. The 3D view is one part of the page, not a separate tech stack.

- **Structured loading and errors** — The GLB ship model is loaded via `useGLTF` with Suspense; errors (e.g. missing model or lost graphics context) are caught and shown with clear messages and recovery options (e.g. “Try again”).

- **Separation of concerns** — Configuration (e.g. model path, colors, layout) is kept in a config module; the scene only handles rendering and interaction.

This keeps the feature easier to test, extend, and integrate with future product requirements.

---

## 3. Use of Modern Graphics APIs (WebGPU)

The implementation targets **modern graphics APIs** where possible. In particular:

- **WebGPU** is the latest standard for high-performance graphics on the web. It offers better use of modern GPUs, more predictable performance, and a path to compute and advanced rendering features.

- The **Three.js WebGPURenderer** is designed to use WebGPU when the browser and device support it. The same application code can run on either WebGPU or WebGL, depending on what the runtime provides.

- The rendering pipeline is built so that **WebGPU can be enabled** when the full stack (including event handling and controls) supports it. Until then, the Ship Visualizer runs on **WebGL 2** to ensure full compatibility with orbit controls (rotate, zoom, pan) and pointer events across all supported browsers.

---

## 4. Fallback for Devices Without WebGPU Support

To support a wide range of devices and browsers, the solution includes **automatic fallback**:

- When **WebGPU is not available** (e.g. older browsers, some mobile devices, or environments that do not yet expose WebGPU), Three.js’s WebGPURenderer can switch to a **WebGL 2** backend. The user gets the same 3D experience without requiring WebGPU support.

- This fallback is **handled inside the rendering library** (Three.js). The application does not need separate code paths for WebGPU vs WebGL; one renderer implementation is used, and the backend is selected at runtime.

- As a result, the application can **target the latest technology (WebGPU)** on capable devices while **remaining usable** on devices that only support WebGL 2, ensuring broad compatibility and a single, maintainable codebase.

---

## 5. Model Loading: Multiple Formats and Sources

The visualizer is designed to **load multiple types of 3D models**. The underlying stack (Three.js and @react-three/drei) supports the following formats:

- **GLB** — Binary glTF; single file, compact, fast to load.
- **GLTF** — glTF 2.0 (JSON); can reference external assets (binaries, textures).
- **FBX** — Autodesk FBX (version 7.0+, ASCII or binary 6400+); common in DCC tools.
- **OBJ** — Wavefront OBJ (geometry; often used with MTL for materials).
- **STL** — Stereolithography; common for 3D printing and simple meshes.
- **Other formats** — Three.js also provides or can be extended with loaders for formats such as 3DS, PLY, SVG (as geometry), and others as needed.

The application can be configured to use any of these via the appropriate loader and a given URL or path. The current Ship Visualizer uses GLB by default; support for additional formats is a matter of wiring the corresponding loader and a configurable model source.

**Why GLB/GLTF is the best choice for the browser**

For production use in the browser, **GLB/GLTF is the recommended format**:

- **Designed for the web** — glTF is an open standard aimed at 3D delivery in web and real-time applications, with minimal parsing and good tooling support.
- **Efficient loading** — GLB is a single binary file (geometry, materials, textures in one asset), which reduces requests and decoding overhead compared to many other formats.
- **Strong compression** — Support for extensions like Draco mesh compression and texture compression (e.g. KTX2) keeps file size and bandwidth low.
- **Wide support** — Export and validation tools (e.g. from Blender, Maya, and online validators) make it easier to produce and debug assets that work reliably in the browser.
- **Consistent behavior** — GLB/GLTF tends to give more predictable results across devices and browsers than formats that were not designed primarily for web use.

FBX and OBJ remain useful for interchange and legacy pipelines, but for final delivery and rendering in the browser, GLB/GLTF is the preferred option.

**Local and remote model sources**

Models can be **loaded from local storage or downloaded from any storage** and then rendered:

- **Local** — Files served from the application’s public folder (e.g. `/ship/model.glb`) or selected by the user from the device (file picker) and loaded via object URLs or the File API.
- **Remote** — Any URL that the browser can fetch (e.g. CDN, cloud storage, internal API) can be passed to the loader; the model is downloaded and parsed, then rendered in the same 3D scene.
- **Access control** — When loading from remote storage, standard browser and server mechanisms (CORS, authentication headers, signed URLs) apply; the visualizer simply consumes the URL or blob provided by the application.

The rendering pipeline is **source-agnostic**: once the application has a URL or a blob (e.g. from a download or upload), the same loading and rendering path is used, so the model can come from local disk, a server, or any storage backend the application integrates with.

---

*This description can be copied as-is into a Word document. Headings and bullet lists will paste cleanly; you may adjust formatting (e.g. bold, spacing) to match your document style.*

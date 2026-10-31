# WinDesktop WebSkin Declarative Architecture

Status: normative implementation specification

This document defines authoring files, JSON schemas, compiler behavior, generated packages, browser behavior, persistence, diagnostics, and the transition system for declarative themes.

Machine-readable schemas live beside this document:

~~~text
schema/common.schema.json
schema/theme.schema.json
schema/scene.schema.json
~~~

The schemas validate structure. The compiler performs the semantic checks described here after schema validation.

## 1. Scope and terms

The compiler converts a declarative theme into a browser package. WebView2 loads the generated package. The browser does not parse source JSON or run a general scene compiler.

This specification uses four labels:

- **Required:** The implementation must support the behavior.
- **MVP:** The first implementation must support the behavior.
- **Post-MVP:** The architecture defines the behavior, but implementation follows the visual compiler.
- **Extension:** A trusted common module can add the behavior through a documented contract.

The specification removes the old runtime scene manager from ordinary declarative themes. Existing handwritten themes may continue to use existing runtime utilities until the project makes a separate compatibility decision.

## 2. Goals

The system must:

1. Compile strict, versioned JSON into HTML, CSS, assets, and selected runtime modules.
2. Require one background composition at the bottom of every scene.
3. Support nested z-stacks, layers, layouts, widgets, images, animations, and custom visual components.
4. Use CSS for ordinary layout.
5. Resolve runtime implementations from the common root without an accepted-module registry.
6. Report precise source locations when compilation fails.
7. Warn when a layer completely covers another node.
8. Let theme authors expose safe position, size, visibility, and group-scale controls.
9. Persist declared user overrides through the existing theme settings namespace.
10. Keep transition coordination separate from scene compilation.

The system must not:

- Interpret source JSON in the browser.
- Ship a general-purpose browser geometry engine for declarative scenes.
- Require a special schema node for a specific visual such as rain.
- Treat an advertised transition capability as proof that a transition completed.
- Allow an asset or module reference to escape its configured root.

## 3. Runtime boundaries

### 3.1 Build and runtime flow

~~~text
theme source
├── theme.json
├── scene.json
├── styles/
└── assets/
        |
        v
declarative compiler
├── parse with source locations
├── validate schema
├── validate semantic rules
├── resolve assets and common modules
├── build ThemeIR
├── emit HTML and CSS
├── emit selected runtime imports
├── analyze coverage
└── publish package atomically
        |
        v
compiled theme package
├── index.html
├── metadata.json
├── generated CSS
├── assets/
├── chunks/
└── transition-manifest.json when transitions exist
        |
        v
WebView2
~~~

The compiler runs at build or installation time. It never runs during a theme switch.

### 3.2 Ownership

| Concern | Owner |
| --- | --- |
| Source schema and semantic validation | Compiler |
| Layout HTML and CSS emission | Compiler |
| Asset dependency discovery | Compiler |
| Common runtime module resolution | Compiler and common build |
| Live widget updates | Selected common widget |
| User override merge | Generated bootstrap and settings API |
| Theme selection | Dashboard or host |
| Switch state and exit reports | Backend coordinator |
| WebView navigation | Windows host |

### 3.3 Existing package boundary

The backend recognizes a routable theme through:

- metadata.json
- index.html

The compiler preserves this boundary. Source theme.json does not replace metadata.json.

Relative package URLs resolve under /themes/{themeId}/.

## 4. Common root and module resolution

The project uses one logical common root:

~~~text
source build root:  common/src/**
runtime file root: localdata/common/**
browser URL root:  /common/**
~~~

The existing common build preserves source paths when it writes localdata/common.

### 4.1 No accepted-module registry

The compiler does not maintain a list of accepted widget, layout, scene, or component IDs.

A theme supplies a logical module path and export name. The compiler:

1. Resolves the path under the configured common root.
2. Rejects absolute paths, traversal, null bytes, and paths outside the root.
3. Maps source TypeScript files to their built JavaScript runtime paths.
4. Loads or inspects the module during compilation.
5. Checks the requested export contract.
6. Emits only references needed by the theme.

Adding a valid module under the selected common root makes the module available. The author accepts responsibility for that module.

The backend common-widget settings resolution does not decide whether a declarative module is valid.

Every declarative runtime capability must resolve from the common tree. This includes widgets, custom layouts, scene components, and composition helpers. Theme JSON supplies the data and structure; common supplies the runtime or compiler implementation.

### 4.2 Module contracts

Runtime widget and visual modules export a factory:

~~~ts
export function create(options: Record<string, unknown>): HTMLElement | SVGElement;
~~~

The returned root may expose:

~~~ts
destroy?: () => void;
~~~

The compiler layout extension contract runs during compilation:

~~~ts
export function compileLayout(input: {
  node: unknown;
  children: unknown[];
  context: unknown;
}): {
  html: string;
  css: string;
  dependencies?: string[];
  bounds?: unknown;
};
~~~

The compiler trusts layout extensions only when the configured build environment permits trusted common code. Runtime browser modules cannot execute as compiler extensions.

## 5. Authoring files

### 5.1 theme.json

theme.json identifies the theme and points to source files.

~~~json
{
  "schemaVersion": 1,
  "id": "aurora",
  "name": "Aurora",
  "files": {
    "scene": "./scene.json",
    "styles": [
      "./styles/theme.css"
    ]
  },
  "viewport": {
    "designSize": {
      "width": 1920,
      "height": 1080
    },
    "fit": "responsive",
    "overflow": "hidden"
  },
  "screenSupport": {
    "profiles": [
      {
        "id": "wide",
        "match": {
          "aspectRatio": {
            "min": 1.6,
            "max": 2
          }
        }
      },
      {
        "id": "generic",
        "match": {
          "any": true
        }
      }
    ],
    "fallbackProfile": "generic"
  },
  "customization": {
    "settingsNamespace": "themes",
    "invalidValuePolicy": "use-default"
  }
}
~~~

The compiler rejects a missing scene, duplicate profile ID, missing fallback profile, invalid path, or unsupported schema version.

### 5.2 scene.json

scene.json defines one root stack. The root owns one mandatory background and any number of top-level layers.

~~~json
{
  "schemaVersion": 1,
  "root": {
    "kind": "stack",
    "id": "root",
    "background": {
      "kind": "background",
      "id": "background",
      "composition": {
        "mode": "runtime",
        "main": {
          "src": "./assets/background.png"
        },
        "anchor": {
          "source": "center",
          "viewport": "center"
        },
        "overlays": []
      }
    },
    "layers": [
      {
        "kind": "layer",
        "id": "widgets",
        "zIndex": 10,
        "content": {
          "kind": "layout",
          "id": "widget-grid",
          "layout": {
            "type": "grid",
            "columns": [
              "1fr",
              "1fr"
            ],
            "rows": [
              "auto",
              "auto"
            ],
            "gap": {
              "value": 20,
              "unit": "px"
            }
          },
          "children": [
            {
              "kind": "widget",
              "id": "clock",
              "module": {
                "path": "widgets/time/clock/digital-plain.js",
                "export": "createClock"
              },
              "props": {
                "format": "24h",
                "seconds": false
              }
            }
          ],
          "userControls": {
            "scale": {
              "enabled": true,
              "defaultPercent": 100,
              "minPercent": 75,
              "maxPercent": 150,
              "anchor": {
                "x": 0.5,
                "y": 0.5
              }
            }
          }
        }
      }
    ]
  }
}
~~~

The schema rejects a second root background, a background inside a nested layer, a duplicate node ID, and a layer without content.

## 6. Viewport and screen support

### 6.1 Design viewport

viewport.designSize supplies a logical width and height. The compiler uses it for:

- Build-mode composition.
- Static coverage analysis.
- Absolute-position normalization.
- Design-space CSS.

The browser maps the generated scene to the active viewport through the selected fit mode:

- responsive: native CSS adapts to available space.
- design-space: preserve the design coordinate system through a root wrapper.
- fixed: preserve fixed dimensions and apply the declared overflow behavior.

The background always covers the complete active viewport. Its crop and placement follow its anchor pair.

### 6.2 Screen profiles

Profiles describe compatibility. They do not supply alternate scene values.

A profile can match:

- Exact dimensions.
- Width or height ranges.
- Aspect-ratio ranges.
- Orientation.
- Any display.

The runtime scores matches by specificity:

1. Exact dimensions.
2. Dimension and ratio constraints.
3. Ratio or dimension constraints.
4. Orientation.
5. any.

The runtime uses the first matching profile at equal specificity. The compiler rejects duplicate IDs and an unresolved fallback. The runtime uses the fallback when no specific profile matches.

## 7. Background composition

### 7.1 Cover calculation

Let:

- frameWidth, frameHeight be the active logical viewport.
- imageWidth, imageHeight be the main image dimensions.
- sourceAnchor be the normalized point inside the source image.
- viewportAnchor be the normalized point inside the viewport.

The compositor calculates:

~~~text
scale = max(frameWidth / imageWidth, frameHeight / imageHeight)
drawWidth = imageWidth * scale
drawHeight = imageHeight * scale
offsetX = viewportAnchor.x * frameWidth
           - sourceAnchor.x * drawWidth
offsetY = viewportAnchor.y * frameHeight
           - sourceAnchor.y * drawHeight
~~~

This keeps the main image covering the viewport while allowing top, bottom, side, corner, and custom anchor placement.

### 7.2 Overlay images

The compositor draws overlays in array order. Each overlay uses the main image's original pixel coordinate space:

- x, y: source-space position.
- anchor: normalized point inside the overlay.
- scale: positive multiplier.
- rotation: degrees.
- opacity: range 0 to 1.
- flipX, flipY: Boolean transforms.

The compositor applies the main image's cover scale and offset to every overlay. Transparent overlay images retain transparency.

### 7.3 Runtime and build modes

Runtime mode emits a generated composition call through a logical common capability. The current implementation maps that capability to static-image-composition.ts.

Build mode runs the same normalized composition contract through a browser-capable build adapter and emits a finished image. The build adapter must preserve anchor, cover, overlay order, scale, rotation, opacity, and flip behavior.

The compiler configuration owns the physical module path. Theme JSON stores logical asset references and never depends on the current source location of the helper.

## 8. Scene tree and layers

### 8.1 Stack behavior

A stack creates a local stacking context. Its layers sort by:

1. Numeric zIndex.
2. Source order for equal values.

Each layer owns one content node. Authors place multiple items in a layer by using a nested layout or stack.

Nested stacks reset local ordering. A child zIndex cannot move content outside its parent stack.

### 8.2 Generic visual content

The compiler supports these node kinds:

- background
- stack
- layer
- layout
- asset
- widget
- component

asset.media supports:

- image
- animated-image
- video

An asset can occupy any layer. The compiler does not infer the asset's purpose. A full-screen image, weather animation, decorative overlay, mask, and video use the same asset contract.

Common components provide custom visuals and interactions. Their module contract determines their behavior.

### 8.3 Layer output

The compiler emits:

~~~html
<main data-ws-scene="root">
  <div data-ws-layer="background"></div>
  <div data-ws-layer="widgets"></div>
</main>
~~~

Generated classes use a theme-scoped prefix. Node IDs remain in data attributes for diagnostics and override lookup. The compiler escapes IDs before placing them in HTML or CSS.

## 9. Placement and sizing

Every node uses one placement mode:

### 9.1 flow

The parent layout positions the node. The node cannot provide absolute x or y values in this mode.

### 9.2 absolute

The node positions itself relative to its nearest positioned wrapper. x and y use typed measures.

Percent values use the wrapper's corresponding axis:

- Horizontal values use wrapper width.
- Vertical values use wrapper height.

### 9.3 anchor

The node aligns its source anchor with the wrapper target anchor. Optional offsets use typed measures.

### 9.4 dock

The node attaches to a named corner or edge. Optional offsets move it within the wrapper.

### 9.5 Size

Nodes may declare width, height, minimum size, and maximum size. auto preserves intrinsic or layout-driven sizing.

The compiler rejects conflicting fields, invalid units, negative dimensions, and a percentage value without a containing wrapper.

## 10. Layouts

### 10.1 MVP layouts

The first compiler implements:

- h-stack with Flexbox row behavior.
- v-stack with Flexbox column behavior.
- grid with CSS Grid tracks.
- center with native centering.
- z-stack through the stack node.
- absolute and canvas placement through positioned wrappers.

The compiler emits CSS. It does not ship LayoutDescriptor.calculate() or a general geometry registry for these scenes.

### 10.2 Post-MVP layouts

The architecture reserves contracts for:

- Flow and wrapping.
- Split tracks.
- Overlay placement.
- Scroll regions.
- Dock regions.
- Aspect-ratio wrappers.
- Responsive composition.

Each layout must define its CSS semantics, allowed fields, intrinsic sizing behavior, overflow behavior, and nested-child rules.

### 10.3 Custom layouts

A custom layout references a common compiler extension module. The module returns HTML, CSS, dependencies, and optional bounds. The compiler validates its result before publication.

Custom layouts cannot access WebView2, FastAPI, or live DOM objects during compilation.

## 11. Widgets and components

A widget node supplies:

- Stable node ID.
- Common module path.
- Export name.
- JSON object of constructor properties.
- Optional declared bounds.

The compiler resolves only referenced modules. A theme using one clock does not import calendar, timer, or system widget modules.

The generated wrapper owns:

- Node identity.
- Placement.
- User overrides.
- CSS classes.
- Widget cleanup.

The widget owns:

- Live data subscriptions.
- Event listeners.
- Internal DOM.
- Its destroy lifecycle.

The generated bootstrap calls destroy() before removing a live node.

## 12. User controls and persistence

### 12.1 Declared controls

A node may expose:

- Position controls.
- Size controls.
- Visibility controls.

A group node may also expose scale controls.

The compiler emits a control manifest containing:

- Theme ID.
- Node ID.
- Allowed fields.
- Default values.
- Minimum and maximum values.
- Scale anchor.

The runtime ignores persisted fields absent from this manifest.

### 12.2 Group scaling

Group scaling wraps the group's compiled contents in a transform wrapper:

~~~css
transform-origin: 50% 50%;
transform: scale(var(--ws-group-scale));
~~~

The layout engine computes child placement before the transform. The transform scales the complete group around the declared anchor.

The runtime clamps scalePercent to the declared range. The theme author controls which groups expose this setting.

### 12.3 Settings format

The existing themes namespace stores overrides:

~~~json
{
  "version": 1,
  "themes": {
    "aurora": {
      "overrides": {
        "widget-grid": {
          "scalePercent": 125
        },
        "clock": {
          "position": {
            "x": {
              "value": 10,
              "unit": "percent"
            }
          }
        }
      }
    }
  }
}
~~~

The runtime reads settings through the existing settings service. The service writes through its atomic storage path. The compiler does not write user settings.

Invalid values use theme defaults. Unknown nodes and fields do not fail theme startup.

## 13. Compiler architecture

### 13.1 Stages

~~~text
discover
→ parse with source locations
→ validate JSON Schema
→ validate semantic rules
→ resolve paths and common modules
→ build dependency graph
→ normalize to ThemeIR
→ emit HTML and CSS
→ emit selected runtime imports
→ analyze coverage
→ emit metadata and manifests
→ stage output
→ validate output
→ publish atomically
~~~

### 13.2 ThemeIR

The intermediate representation contains normalized data:

~~~ts
type ThemeIR = {
  id: string;
  name: string;
  schemaVersion: number;
  viewport: ViewportIR;
  screenProfiles: ScreenProfileIR[];
  fallbackProfile: string;
  scene: SceneIR;
  assets: AssetIR[];
  modules: CommonModuleIR[];
  controls: ControlManifestIR[];
  diagnostics: Diagnostic[];
  transitions?: TransitionIR;
};
~~~

ThemeIR contains no DOM nodes, WebView2 objects, FastAPI objects, or browser state.

### 13.3 Dependency graph

The compiler records:

- Referenced source files.
- Referenced assets.
- Common module paths.
- Export names.
- CSS files.
- Generated runtime chunks.
- Composition mode.
- User-control declarations.

The graph excludes unreachable widgets, assets, layouts, and transitions.

### 13.4 Publication

The compiler writes into a staging directory below the selected output root. It validates:

- metadata.json.
- index.html.
- Asset existence.
- Generated import paths.
- Manifest references.
- Package path safety.

The compiler replaces the active package only after validation succeeds. A failed build leaves the last valid package available.

## 14. Diagnostics

### 14.1 Diagnostic shape

Every error and warning uses:

~~~ts
type Diagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  file: string;
  line: number;
  column: number;
  jsonPointer?: string;
  nodeId?: string;
  relatedFile?: string;
  relatedNodeId?: string;
  hint?: string;
};
~~~

The parser must retain line and column data. JSON Schema errors alone do not satisfy this requirement.

### 14.2 Required error classes

The compiler reports distinct codes for:

- Unsupported schema version.
- Invalid JSON.
- Missing referenced file.
- Unsafe path.
- Duplicate ID.
- Unknown node kind.
- Invalid placement combination.
- Invalid layout field.
- Invalid module export.
- Missing asset.
- Missing screen fallback.
- Invalid scale limits.
- Invalid composition mode.
- Output publication failure.

## 15. Occlusion analysis

The compiler analyzes each stack against the design viewport and declared screen profiles.

### 15.1 Definite coverage

The compiler emits WS-OCCLUSION-DEFINITE when it can prove that a later opaque node covers the full bounds of an earlier node.

The proof may use:

- Explicit absolute bounds.
- Declared asset bounds.
- Fixed layout dimensions.
- Opaque background or asset metadata.
- Stack z-order.
- Clipping rules.

### 15.2 Possible coverage

The compiler emits WS-OCCLUSION-POSSIBLE when coverage depends on:

- Responsive CSS.
- Intrinsic image dimensions.
- Widget output.
- Animation frames.
- Video frames.
- Custom common-component bounds.
- Runtime user overrides.

Possible warnings identify the unknown input.

Coverage warnings never fail compilation. intentionalOcclusion: true suppresses duplicate warnings for a declared layer while preserving diagnostics for unrelated covered nodes.

## 16. Generated browser runtime

The browser receives generated code. It does not receive a JSON renderer.

The generated bootstrap:

1. Loads generated CSS and static markup.
2. Resolves declared settings.
3. Applies validated user overrides.
4. Starts selected common widgets and components.
5. Starts runtime background composition when required.
6. Registers cleanup handlers.
7. Enters stable state.

The bootstrap may contain feature-specific runtime code for:

- Live widgets.
- Image composition.
- Custom visual components.
- Transitions.

It must not contain a general layout calculator or a general-purpose scene interpreter.

If a runtime asset fails to load, the bootstrap reports the asset and node ID, keeps the document alive, and applies the theme's safe visual fallback. A missing source asset still fails compilation before publication.

## 17. Transition system

Transitions remain a post-MVP feature. The compiler and runtime must preserve these meanings.

### 17.1 Concepts

Keep these values separate:

- Requested exit.
- Chosen exit variant.
- Advertised exit capability.
- Exit completion status.
- Actual visual outcome.
- Entrance selection.

An incoming theme may suggest an outgoing result. The outgoing theme may ignore the suggestion. The incoming theme selects its entrance from the actual reported outcome.

entrance.json remains an optional source file containing ordered suggestions for the previous theme. It does not control the previous theme.

### 17.2 Outcomes

The shared outcome vocabulary includes:

- screen-black
- screen-white
- opaque
- transparent
- stable
- none
- unknown
- failed

The host must define what each outcome means for the WebView surface. transparent does not promise that the desktop or wallpaper appears beneath the page.

### 17.3 Coordinator

The backend coordinator owns:

- switchId.
- viewInstanceId.
- Source theme.
- Target theme.
- Generation ID.
- Requested exit.
- Reported outcome.
- Terminal status.
- Expiry.

The host owns navigation. The backend owns switch state. One active switch exists per WebView/display. New requests supersede older requests through generation IDs.

The host uses its WebView2 bridge to notify the outgoing page. The page reports bounded, correlated results to the backend. The coordinator rejects stale, duplicate, wrong-view, and out-of-order reports.

The coordinator uses bounded in-memory state first. It retains a context until the incoming theme consumes it or the context expires.

### 17.4 Failure behavior

The coordinator completes a switch within explicit delivery, exit, query, and entrance timeouts.

On crash, teardown, timeout, or unreachable backend:

- The switch becomes unknown or failed.
- The host continues navigation according to its safe policy.
- The new theme uses its default entrance.
- The scene reaches stable state.

## 18. Security and compatibility

The compiler:

- Resolves every source path relative to its declared root.
- Rejects traversal and absolute paths.
- Restricts common modules to configured roots.
- Escapes generated HTML and CSS identifiers.
- Does not evaluate arbitrary expressions in JSON.
- Uses explicit module exports.
- Treats custom compiler extensions as trusted build code.

The system keeps separate version markers:

- Source schema version.
- Compiled package version.
- Transition manifest version.
- Settings storage version.

The existing metadata.json and index.html package contract remains stable. Browser URLs remain under /themes/{themeId}/ and /common/.

## 19. MVP implementation order

The implementation must follow this order:

1. Validate theme.json and scene.json with the new schemas.
2. Parse source files with line and column tracking.
3. Resolve common modules without an accepted-module registry.
4. Build ThemeIR and a dependency graph.
5. Compile the mandatory runtime background composition.
6. Emit the root stack and nested layers.
7. Emit static images, animated images, and video assets.
8. Emit h-stack, v-stack, grid, and center.
9. Emit one existing common widget.
10. Emit screen compatibility metadata and fallback selection.
11. Apply declared position, size, visibility, and group-scale overrides.
12. Emit definite and possible occlusion warnings.
13. Add build-mode composition through the shared composition contract.
14. Add transitions, lazy chunks, backend coordination, and host integration.

MVP excludes active theme transitions, true crossfade overlap, multi-monitor coordination, arbitrary transition JavaScript, and runtime scene interpretation.

## 20. Test matrix

### 20.1 Schema tests

The schema validator must cover:

- Valid minimal theme.
- Valid root background.
- Missing background.
- Duplicate IDs.
- Invalid layer nesting.
- Invalid placement fields.
- Invalid units.
- Invalid scale limits.
- Missing screen fallback.
- Invalid profile match.
- Invalid module path.
- Missing required module export field.
- Invalid composition overlay.
- Unsupported schema version.

### 20.2 Compiler tests

The compiler must verify:

- Background cover behavior.
- Named anchors.
- Custom source and viewport anchors.
- Multiple overlay ordering.
- Overlay scale, rotation, opacity, and flips.
- Nested z-stack ordering.
- Generic image and animation layers.
- CSS output for MVP layouts.
- Common module resolution.
- Unused widget exclusion.
- User-scale transform around its anchor.
- Settings merge and clamping.
- Definite occlusion warning.
- Possible occlusion warning.
- Compilation continues after warnings.
- Source file and JSON pointer diagnostics.
- Failed builds preserve the previous package.
- Generated packages include valid metadata and index files.
- Generated runtime code contains no general layout calculator.

### 20.3 Transition tests

Post-MVP lifecycle tests must cover:

- Actual outcome selection.
- Ignored exit suggestion.
- Failed exit report.
- Missing previous outcome.
- Backend timeout.
- Stale report.
- Duplicate report.
- Rapid superseding switches.
- Page teardown during exit.
- Reduced-motion policy.

## 21. Acceptance criteria

The implementation satisfies this specification when:

1. A declarative theme requires one valid background composition.
2. The background covers the active viewport and honors its anchor pair.
3. Nested stacks and layers produce deterministic local z-order.
4. Any generic asset can occupy any layer.
5. A theme can use common modules without a central accepted-module registry.
6. Invalid source files produce file, line, column, and JSON pointer diagnostics.
7. Definite and possible coverage warnings do not block compilation.
8. Declared user controls merge from the existing theme settings namespace.
9. Group scale changes the complete group around its declared anchor.
10. The browser loads generated output without parsing source JSON.
11. The browser loads no general scene or layout calculator.
12. A failed build leaves the last valid package available.
13. Transition code remains separate from the visual compiler and follows actual-outcome semantics.

## 22. Glossary

- **Asset:** A theme-owned image, animated image, or video file.
- **Background composition:** The mandatory lowest visual built from one main image and ordered overlays.
- **Common root:** The configured source or runtime directory that supplies shared modules.
- **Design viewport:** Logical width and height used for composition and analysis.
- **Layer:** One child of a stack with a local z-index and one content node.
- **Layout:** A CSS-emitting arrangement of child nodes.
- **Node:** One typed scene element.
- **Stack:** A local stacking context containing ordered layers.
- **ThemeIR:** Compiler-owned normalized representation of one theme.
- **User control:** A field that a theme explicitly permits persistence to modify.
- **View instance:** One host-owned WebView/display lifecycle identity.

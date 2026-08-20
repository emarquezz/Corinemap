# Corinemap

Corinemap is a focused pathway editor and figure-making application for a *Corynebacterium glutamicum* metabolic map. It uses the Escher map editor and adds configurable categorical reaction styling, metabolite styling, named flux datasets, CSV import, an editable SVG legend, and complete Corinemap workspaces.

## Run locally

The application is static and does not need a build step. Serve the repository root with any local HTTP server, then open `/app/`:

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000/app/corinemap.html`. Opening the page directly with a `file://` URL will prevent the browser from loading the map JSON.

The original Escher-Trace analysis interface remains temporarily available at `/app/index.html` for comparison while the focused interface is validated. New Corinemap styling and category features are implemented on the focused page.

Corinemap loads the bundled `iCW773` COBRA model together with the default map. This enables Escher's reaction-building and model-aware editing tools immediately; no separate model upload is required.

## Reaction categories

Open **Categories & legend** to edit category values, labels, colors, reaction-line sizes, and which entries appear in the legend. You can also assign a category to one reaction directly in this dialog.

Import one or several reaction-data CSV files at once. Each file becomes a named tab that can be selected, renamed, or removed without reloading the map. Accepted column names include `reaction_id`/`category` and `reaction`/`regulation`. A category can be either its numeric value or its current label:

```csv
reaction_id,category
PGK,No change
GND,1
FUM,Increased expression
```

See [`docs/example_files/Corinemap_Reaction_Categories.csv`](docs/example_files/Corinemap_Reaction_Categories.csv) for an example.

Mannitol and Xylose are bundled as the initial tabs and load automatically from `app/data/`. To change the datasets that open with the page, add the CSV files to that directory and edit `preloadedReactionDatasets` in `app/js/corinemap/config.js`.

Use **Hide** in the Corinemap panel header to collapse the controls into a compact **Show controls** button. The preference is remembered in the browser.

Open **Advanced appearance** to use a side editor while keeping the map visible. Valid number and color changes preview immediately; **Apply** keeps them and **Cancel** restores the previous appearance. You can adjust reaction-label fonts; primary, secondary, highlighted, and extracellular metabolite label sizes and circle radii; and normal, green-highlighted, or purple-extracellular metabolite colors. Special sizes apply to primary nodes only: secondary nodes such as `h_e` retain the compact secondary size while keeping their special color. Appearance settings are included in saved Corinemap workspaces.

## Maps and workspaces

- Escher's **Map** menu saves or opens ordinary Escher map JSON and exports SVG or PNG figures.
- **Save workspace** stores the map, every named flux dataset, the active tab, editable categories, and legend settings together. Workspaces saved by the earlier single-dataset version are migrated automatically when opened.
- **Open JSON/workspace** accepts either a plain Escher map or a complete Corinemap workspace.

## Validate changes

Node.js is only used for repository checks; the application itself runs directly in the browser.

```bash
npm test
```

The checks validate local asset references, JavaScript syntax, event-handler conventions, and the structure of every Escher map JSON file.

## Repository layout

- `app/corinemap.html`: focused Corinemap interface.
- `app/js/corinemap/`: Corinemap configuration, styling, data import, workspace, and UI modules.
- `app/data/`: CSV datasets loaded automatically when Corinemap starts.
- `app/models/cglutamicum_mtl_escher.json`: default `iCW773` COBRA model used for reaction editing.
- `app/index.html`: legacy Escher-Trace interface retained during migration.
- `app/Corinebacterium_Glutamicum.json`: active Escher map.
- `app/js/escher.js`: customized Escher 1.6 vendor bundle.
- `app/css/`: application and vendor styles.
- `docs/`: inherited Escher-Trace documentation.

## Refactoring direction

The focused interface does not load Escher-Trace's isotope correction, normalization, time-course, DataTables, Math.js, or tracing-chart code. Corinemap-specific behavior belongs in `app/js/corinemap/`; avoid adding new behavior to the Escher vendor bundle. The bundle retains one documented compatibility change so Escher accepts Corinemap's discrete value-only reaction scale instead of requiring continuous `min` and `max` entries.

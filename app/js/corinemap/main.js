import {
  APP_CONFIG,
  categoriesToReactionScale,
  cloneDefaultAppearance,
  cloneDefaultCategories,
} from './config.js';
import {
  installMapCustomization,
  redrawAppearance,
  renderLegend,
  updateReactionScale,
} from './map-customization.js';
import {
  countMatchingReactions,
  getMapReactionIds,
  parseReactionCsv,
} from './reaction-data.js';
import {
  createReactionDataset,
  getActiveDataset,
  suggestDatasetName,
  uniqueDatasetName,
} from './reaction-datasets.js';
import { createInterface } from './ui.js';
import {
  createWorkspace,
  downloadJson,
  isEscherMap,
  readJsonFile,
  validateWorkspace,
} from './workspace.js';

const state = {
  categories: cloneDefaultCategories(),
  datasets: [],
  activeDatasetId: null,
  appearance: cloneDefaultAppearance(),
  appearancePreview: null,
  legend: { ...APP_CONFIG.legend },
};

let builder;
let ui;

function assertRuntimeDependencies() {
  const missing = [];
  if (!window.jQuery) missing.push('jQuery');
  if (!window.jQuery?.fn?.button) missing.push('Bootstrap JavaScript');
  if (!window.d3) missing.push('D3');
  if (!window.escher?.Builder) missing.push('Escher');
  if (missing.length > 0) {
    throw new Error(`Missing required runtime dependencies: ${missing.join(', ')}.`);
  }
}

function applyActiveReactionData() {
  const reactionData = getActiveDataset(state)?.reactionData ?? {};
  const hasData = Object.keys(reactionData).length > 0;
  builder.set_reaction_data(hasData ? reactionData : null);
}

function datasetMatchSummary(dataset) {
  const total = Object.keys(dataset.reactionData).length;
  const matched = countMatchingReactions(builder, dataset.reactionData);
  return { total, matched, unmatched: total - matched };
}

function activeDatasetMessage(dataset) {
  const { total, matched, unmatched } = datasetMatchSummary(dataset);
  const outsideMap = unmatched > 0
    ? ` ${unmatched} assignment(s) are outside the displayed map.`
    : '';
  return `${dataset.name}: showing ${matched} of ${total} reaction assignment(s).${outsideMap}`;
}

function selectDataset(datasetId, announce = true) {
  const dataset = state.datasets.find((candidate) => candidate.id === datasetId);
  if (!dataset) return;
  state.activeDatasetId = dataset.id;
  applyActiveReactionData();
  ui?.refreshDatasets();
  if (announce) ui?.setStatus(activeDatasetMessage(dataset));
}

function refreshMapInterface() {
  installMapCustomization(builder, state, APP_CONFIG);
  ui?.refreshReactionIds(getMapReactionIds(builder));
}

function wrapMapLoading() {
  const loadMap = builder.load_map.bind(builder);
  builder.load_map = (mapData, shouldUpdateData) => {
    loadMap(mapData, shouldUpdateData);
    refreshMapInterface();
  };
}

function saveWorkspace() {
  downloadJson(createWorkspace(builder, state), 'Corinemap_workspace.json');
  ui.setStatus('Workspace saved.');
}

async function loadWorkspace(file) {
  const value = await readJsonFile(file);

  if (isEscherMap(value)) {
    builder.load_map(value);
    applyActiveReactionData();
    const activeDataset = getActiveDataset(state);
    const datasetMessage = activeDataset ? ` ${activeDatasetMessage(activeDataset)}` : '';
    ui.setStatus(`Loaded Escher map ${value[0].map_name || file.name}.${datasetMessage}`);
    return;
  }

  const workspace = validateWorkspace(value);
  state.categories = workspace.categories.map((category) => ({ ...category }));
  state.datasets = workspace.datasets.map((dataset) => ({
    ...dataset,
    reactionData: { ...dataset.reactionData },
    source: 'workspace',
  }));
  state.activeDatasetId = workspace.activeDatasetId;
  state.appearance = {
    ...cloneDefaultAppearance(),
    ...(workspace.appearance ?? {}),
  };
  state.appearancePreview = null;
  state.legend = { ...APP_CONFIG.legend, ...(workspace.legend ?? {}) };
  builder.load_map(workspace.map);
  applyActiveReactionData();
  ui.refreshCategorySelect();
  ui.refreshDatasets();
  ui.setStatus(`Loaded Corinemap workspace from ${file.name}.`);
}

async function importReactionCsv(files) {
  const parsedFiles = await Promise.all(files.map(async (file) => {
    try {
      return {
        file,
        reactionData: parseReactionCsv(
          await file.text(),
          state.categories,
          window.d3.csvParse,
        ),
      };
    } catch (error) {
      throw new Error(`${file.name}: ${error.message}`);
    }
  }));

  const datasets = [...state.datasets];
  const imported = parsedFiles.map(({ file, reactionData }) => {
    const dataset = createReactionDataset({
      name: suggestDatasetName(file.name),
      reactionData,
      source: 'upload',
    }, datasets);
    datasets.push(dataset);
    return dataset;
  });

  state.datasets = datasets;
  state.activeDatasetId = imported[0].id;
  applyActiveReactionData();
  ui.refreshDatasets();
  const plural = imported.length === 1 ? 'dataset' : 'datasets';
  ui.setStatus(`Imported ${imported.length} flux ${plural}. ${activeDatasetMessage(imported[0])}`);
}

function assignReaction(reactionId, categoryValue) {
  let dataset = getActiveDataset(state);
  if (!dataset) {
    dataset = createReactionDataset({
      name: 'Manual data',
      reactionData: {},
      source: 'manual',
    }, state.datasets);
    state.datasets.push(dataset);
    state.activeDatasetId = dataset.id;
  }
  dataset.reactionData[reactionId] = categoryValue;
  applyActiveReactionData();
  ui.refreshDatasets();
  const existsOnMap = getMapReactionIds(builder).includes(reactionId);
  ui.setStatus(
    existsOnMap
      ? `Assigned category ${categoryValue} to ${reactionId} in ${dataset.name}.`
      : `Saved ${reactionId} in ${dataset.name}, but that reaction ID is not present on the current map.`,
    existsOnMap ? 'info' : 'warning',
  );
}

function renameDataset(datasetId, requestedName) {
  const dataset = state.datasets.find((candidate) => candidate.id === datasetId);
  if (!dataset) return;
  const otherDatasets = state.datasets.filter((candidate) => candidate.id !== datasetId);
  const previousName = dataset.name;
  dataset.name = uniqueDatasetName(requestedName, otherDatasets);
  ui.refreshDatasets();
  ui.setStatus(`Renamed ${previousName} to ${dataset.name}.`);
}

function removeDataset(datasetId) {
  const index = state.datasets.findIndex((dataset) => dataset.id === datasetId);
  if (index < 0) return;
  const [removed] = state.datasets.splice(index, 1);
  if (state.activeDatasetId === datasetId) {
    state.activeDatasetId = state.datasets[index]?.id
      ?? state.datasets[index - 1]?.id
      ?? null;
  }
  applyActiveReactionData();
  ui.refreshDatasets();
  const activeDataset = getActiveDataset(state);
  const nextMessage = activeDataset ? ` ${activeDatasetMessage(activeDataset)}` : '';
  ui.setStatus(`Removed ${removed.name}.${nextMessage}`);
}

function clearActiveDataset() {
  const dataset = getActiveDataset(state);
  if (!dataset) {
    ui.setStatus('There is no active flux dataset to clear.', 'warning');
    return;
  }
  dataset.reactionData = {};
  applyActiveReactionData();
  ui.refreshDatasets();
  ui.setStatus(`Cleared reaction assignments from ${dataset.name}.`);
}

function saveCategories(categories, legendTitle) {
  const allowedValues = new Set(categories.map((category) => Number(category.value)));
  const usedValues = new Set(state.datasets.flatMap((dataset) => (
    Object.values(dataset.reactionData).map(Number)
  )));
  const missingValues = [...usedValues].filter((value) => !allowedValues.has(value));
  if (missingValues.length > 0) {
    throw new Error(
      `Keep category value(s) ${missingValues.sort((left, right) => left - right).join(', ')} because they are used by a flux dataset.`,
    );
  }
  state.categories = categories;
  state.legend.title = legendTitle || 'Reaction regulation';
  updateReactionScale(builder, state.categories);
  renderLegend(builder.map, state.categories, state.legend);
  applyActiveReactionData();
}

function saveAppearance(appearance) {
  state.appearance = { ...appearance };
  state.appearancePreview = null;
  redrawAppearance(builder);
}

function previewAppearance(appearance) {
  state.appearancePreview = { ...appearance };
  redrawAppearance(builder);
}

function cancelAppearancePreview() {
  if (state.appearancePreview === null) return;
  state.appearancePreview = null;
  redrawAppearance(builder);
}

async function loadPreloadedDatasets() {
  const results = await Promise.all(APP_CONFIG.preloadedReactionDatasets.map(async (definition) => {
    try {
      const response = await fetch(definition.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const reactionData = parseReactionCsv(
        await response.text(),
        state.categories,
        window.d3.csvParse,
      );
      return { definition, reactionData };
    } catch (error) {
      return { definition, error };
    }
  }));

  const warnings = [];
  results.forEach(({ definition, reactionData, error }) => {
    if (error) {
      warnings.push(`${definition.name}: ${error.message}`);
      return;
    }
    state.datasets.push(createReactionDataset({
      id: definition.id,
      name: definition.name,
      reactionData,
      source: 'preloaded',
    }, state.datasets));
  });
  state.activeDatasetId = state.datasets[0]?.id ?? null;
  return warnings;
}

async function start() {
  assertRuntimeDependencies();
  const mapRequest = fetch(APP_CONFIG.mapUrl).then(async (response) => {
    if (!response.ok) throw new Error(`Could not load the map (${response.status}).`);
    return response.json();
  });
  const modelRequest = fetch(APP_CONFIG.modelUrl).then(async (response) => {
    if (!response.ok) throw new Error(`Could not load the model (${response.status}).`);
    return response.json();
  });
  const [mapData, modelData, preloadWarnings] = await Promise.all([
    mapRequest,
    modelRequest,
    loadPreloadedDatasets(),
  ]);

  const options = {
    ...APP_CONFIG.builderOptions,
    reaction_scale: categoriesToReactionScale(state.categories),
  };
  builder = window.escher.Builder(
    mapData,
    modelData,
    null,
    window.d3.select('#map_container'),
    options,
  );
  window.corinemapBuilder = builder;
  window.corinemapModel = modelData;

  ui = createInterface(state, {
    onCategoriesSave: saveCategories,
    onAppearanceSave: saveAppearance,
    onAppearancePreview: previewAppearance,
    onAppearanceCancel: cancelAppearancePreview,
    onAppearanceDefaults: cloneDefaultAppearance,
    onManualAssignment: assignReaction,
    onReactionCsv: importReactionCsv,
    onDatasetSelect: selectDataset,
    onDatasetRename: renameDataset,
    onDatasetRemove: removeDataset,
    onWorkspaceSave: saveWorkspace,
    onWorkspaceLoad: loadWorkspace,
    onClearReactionData: clearActiveDataset,
  });

  wrapMapLoading();
  refreshMapInterface();
  applyActiveReactionData();
  const activeDataset = getActiveDataset(state);
  const readyMessage = activeDataset
    ? `Corinemap is ready with model ${modelData.id || modelData.name || 'loaded'}. ${activeDatasetMessage(activeDataset)}`
    : `Corinemap is ready with model ${modelData.id || modelData.name || 'loaded'}. Import a flux CSV to begin.`;
  const warningMessage = preloadWarnings.length > 0
    ? ` Could not preload ${preloadWarnings.join('; ')}.`
    : '';
  ui.setStatus(`${readyMessage}${warningMessage}`, preloadWarnings.length > 0 ? 'warning' : 'info');
}

start().catch((error) => {
  console.error(error);
  const status = document.getElementById('corinemap-status');
  if (status) {
    status.textContent = error.message;
    status.dataset.level = 'error';
  }
});

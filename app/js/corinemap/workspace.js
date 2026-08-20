export const WORKSPACE_FORMAT = 'corinemap-workspace';
export const WORKSPACE_VERSION = 3;

const APPEARANCE_NUMBER_KEYS = [
  'reactionLabelSize',
  'primaryMetaboliteLabelSize',
  'secondaryMetaboliteLabelSize',
  'highlightedMetaboliteLabelSize',
  'extracellularMetaboliteLabelSize',
  'primaryMetaboliteRadius',
  'secondaryMetaboliteRadius',
  'highlightedMetaboliteRadius',
  'extracellularMetaboliteRadius',
];

const APPEARANCE_COLOR_KEYS = [
  'normalMetaboliteFill',
  'normalMetaboliteStroke',
  'highlightedFill',
  'highlightedStroke',
  'extracellularFill',
  'extracellularStroke',
];

export function createWorkspace(builder, state) {
  return {
    format: WORKSPACE_FORMAT,
    version: WORKSPACE_VERSION,
    savedAt: new Date().toISOString(),
    map: builder.map.map_for_export(),
    categories: state.categories.map((category) => ({ ...category })),
    datasets: state.datasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      reactionData: { ...dataset.reactionData },
    })),
    activeDatasetId: state.activeDatasetId,
    appearance: { ...state.appearance },
    legend: { ...state.legend },
  };
}

export function isEscherMap(value) {
  return Boolean(
    Array.isArray(value)
      && value.length === 2
      && value[0]
      && 'map_id' in value[0]
      && value[1]?.reactions
      && value[1]?.nodes
      && value[1]?.canvas,
  );
}

export function validateWorkspace(value) {
  if (
    value?.format !== WORKSPACE_FORMAT
      || ![1, 2, WORKSPACE_VERSION].includes(value?.version)
  ) {
    throw new Error('This is not a supported Corinemap workspace.');
  }
  if (!isEscherMap(value.map)) {
    throw new Error('The workspace does not contain a valid Escher map.');
  }
  if (!Array.isArray(value.categories) || value.categories.length === 0) {
    throw new Error('The workspace does not contain reaction categories.');
  }
  const categoriesAreValid = value.categories.every((category) => (
    Number.isFinite(Number(category.value))
      && typeof category.label === 'string'
      && category.label.trim() !== ''
      && typeof category.color === 'string'
      && Number.isFinite(Number(category.size))
      && Number(category.size) > 0
  ));
  if (!categoriesAreValid) {
    throw new Error('The workspace contains an invalid reaction category.');
  }

  const normalized = value.version === 1
    ? migrateVersionOneWorkspace(value)
    : {
      ...value,
      version: WORKSPACE_VERSION,
      datasets: value.datasets ?? [],
      activeDatasetId: value.activeDatasetId ?? value.datasets?.[0]?.id ?? null,
      appearance: value.appearance ?? null,
    };

  if (!Array.isArray(normalized.datasets)) {
    throw new Error('The workspace contains invalid flux datasets.');
  }
  const categoryValues = new Set(normalized.categories.map(
    (category) => Number(category.value),
  ));
  const datasetsAreValid = normalized.datasets.every((dataset) => (
    typeof dataset.id === 'string'
      && dataset.id.trim() !== ''
      && typeof dataset.name === 'string'
      && dataset.name.trim() !== ''
      && isValidReactionData(dataset.reactionData, categoryValues)
  ));
  const datasetIds = normalized.datasets.map((dataset) => dataset.id);
  if (!datasetsAreValid || new Set(datasetIds).size !== datasetIds.length) {
    throw new Error('The workspace contains an invalid flux dataset.');
  }
  if (
    normalized.activeDatasetId !== null
      && !datasetIds.includes(normalized.activeDatasetId)
  ) {
    throw new Error('The workspace refers to a missing active flux dataset.');
  }
  if (!isValidAppearance(normalized.appearance)) {
    throw new Error('The workspace contains invalid appearance settings.');
  }
  return normalized;
}

function isValidReactionData(reactionData, categoryValues) {
  if (!reactionData || typeof reactionData !== 'object' || Array.isArray(reactionData)) {
    return false;
  }
  return Object.entries(reactionData).every(([reactionId, categoryValue]) => (
    reactionId.trim() !== ''
      && Number.isFinite(Number(categoryValue))
      && categoryValues.has(Number(categoryValue))
  ));
}

function migrateVersionOneWorkspace(value) {
  const reactionData = value.reactionData ?? {};
  const hasReactionData = Object.keys(reactionData).length > 0;
  const datasets = hasReactionData
    ? [{
      id: 'imported-data',
      name: 'Imported data',
      reactionData: { ...reactionData },
    }]
    : [];
  return {
    ...value,
    version: WORKSPACE_VERSION,
    datasets,
    activeDatasetId: datasets[0]?.id ?? null,
    appearance: null,
  };
}

function isValidAppearance(appearance) {
  if (appearance === null || appearance === undefined) return true;
  if (typeof appearance !== 'object' || Array.isArray(appearance)) return false;
  const numbersAreValid = APPEARANCE_NUMBER_KEYS.every((key) => (
    !(key in appearance)
      || (Number.isFinite(Number(appearance[key])) && Number(appearance[key]) > 0)
  ));
  const colorsAreValid = APPEARANCE_COLOR_KEYS.every((key) => (
    !(key in appearance)
      || /^#[0-9a-f]{6}$/i.test(appearance[key])
  ));
  return numbersAreValid && colorsAreValid;
}

export async function readJsonFile(file) {
  try {
    return JSON.parse(await file.text());
  } catch (error) {
    throw new Error(`Could not read ${file.name}: ${error.message}`);
  }
}

export function downloadJson(value, fileName) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

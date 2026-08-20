function cleanName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function slugify(value) {
  return cleanName(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'flux-data';
}

export function suggestDatasetName(fileName) {
  const baseName = String(fileName ?? '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!baseName) return 'Flux data';
  return baseName.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function uniqueDatasetName(requestedName, datasets) {
  const baseName = cleanName(requestedName) || 'Flux data';
  const usedNames = new Set(datasets.map((dataset) => dataset.name.toLowerCase()));
  if (!usedNames.has(baseName.toLowerCase())) return baseName;

  let suffix = 2;
  while (usedNames.has(`${baseName} (${suffix})`.toLowerCase())) suffix += 1;
  return `${baseName} (${suffix})`;
}

export function uniqueDatasetId(requestedId, datasets) {
  const baseId = slugify(requestedId);
  const usedIds = new Set(datasets.map((dataset) => dataset.id));
  if (!usedIds.has(baseId)) return baseId;

  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}

export function createReactionDataset({
  id,
  name,
  reactionData,
  source = 'upload',
}, existingDatasets = []) {
  const datasetName = uniqueDatasetName(name, existingDatasets);
  return {
    id: uniqueDatasetId(id || datasetName, existingDatasets),
    name: datasetName,
    reactionData: { ...reactionData },
    source,
  };
}

export function getActiveDataset(state) {
  return state.datasets.find((dataset) => dataset.id === state.activeDatasetId) ?? null;
}

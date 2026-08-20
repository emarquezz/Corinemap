const REACTION_HEADERS = ['reactionid', 'reaction', 'biggid', 'id'];
const CATEGORY_HEADERS = ['category', 'state', 'status', 'value', 'regulation'];

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function findColumn(columns, acceptedNames, fallbackIndex) {
  const normalized = columns.map(normalizeToken);
  const index = normalized.findIndex((column) => acceptedNames.includes(column));
  return columns[index >= 0 ? index : fallbackIndex];
}

export function resolveCategoryValue(rawValue, categories) {
  const valueText = String(rawValue ?? '').trim();
  if (valueText === '') return null;

  const numericValue = Number(valueText);
  if (Number.isFinite(numericValue)) {
    return categories.some((category) => Number(category.value) === numericValue)
      ? numericValue
      : null;
  }

  const normalizedValue = normalizeToken(valueText);
  const category = categories.find(
    (candidate) => normalizeToken(candidate.label) === normalizedValue,
  );
  return category ? Number(category.value) : null;
}

export function parseReactionCsv(csvText, categories, csvParse) {
  if (typeof csvParse !== 'function') {
    throw new Error('A CSV parser is required.');
  }

  const rows = csvParse(csvText);
  const columns = rows.columns ?? Object.keys(rows[0] ?? {});
  if (columns.length < 2) {
    throw new Error('The CSV needs at least two columns: reaction_id and category.');
  }

  const reactionColumn = findColumn(columns, REACTION_HEADERS, 0);
  const categoryColumn = findColumn(columns, CATEGORY_HEADERS, 1);
  const reactionData = {};
  const rowErrors = [];

  rows.forEach((row, index) => {
    const reactionId = String(row[reactionColumn] ?? '').trim();
    const categoryValue = resolveCategoryValue(row[categoryColumn], categories);

    if (!reactionId) {
      rowErrors.push(`row ${index + 2}: missing reaction ID`);
    } else if (categoryValue === null) {
      rowErrors.push(`row ${index + 2}: unknown category "${row[categoryColumn] ?? ''}"`);
    } else {
      reactionData[reactionId] = categoryValue;
    }
  });

  if (rowErrors.length > 0) {
    const preview = rowErrors.slice(0, 5).join('; ');
    const remaining = rowErrors.length > 5 ? `; and ${rowErrors.length - 5} more` : '';
    throw new Error(`Could not import the CSV: ${preview}${remaining}.`);
  }

  if (Object.keys(reactionData).length === 0) {
    throw new Error('The CSV did not contain any reaction assignments.');
  }

  return reactionData;
}

export function getMapReactionIds(builder) {
  const reactions = Object.values(builder?.map?.reactions ?? {});
  return [...new Set(reactions.map((reaction) => reaction.bigg_id).filter(Boolean))].sort();
}

export function countMatchingReactions(builder, reactionData) {
  const mapIds = new Set(getMapReactionIds(builder));
  return Object.keys(reactionData).filter((reactionId) => mapIds.has(reactionId)).length;
}

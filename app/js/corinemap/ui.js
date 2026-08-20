import {
  createAnimationFrameScheduler,
  mergeAppearanceDraft,
  parsePositiveAppearanceNumber,
  requireCompleteAppearanceDraft,
} from './appearance-draft.js';

function requiredElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing interface element #${id}.`);
  return element;
}

const PANEL_STATE_KEY = 'corinemap.controlsCollapsed';
const ISOLATED_KEYBOARD_EVENTS = ['keydown', 'keypress', 'keyup'];

export function isolateMapKeyboardShortcuts(container) {
  ISOLATED_KEYBOARD_EVENTS.forEach((eventName) => {
    container.addEventListener(eventName, (event) => event.stopPropagation());
  });
}

const APPEARANCE_NUMBER_INPUTS = {
  reactionLabelSize: 'appearance-reaction-label-size',
  primaryMetaboliteLabelSize: 'appearance-primary-label-size',
  secondaryMetaboliteLabelSize: 'appearance-secondary-label-size',
  highlightedMetaboliteLabelSize: 'appearance-highlighted-label-size',
  extracellularMetaboliteLabelSize: 'appearance-extracellular-label-size',
  primaryMetaboliteRadius: 'appearance-primary-radius',
  secondaryMetaboliteRadius: 'appearance-secondary-radius',
  highlightedMetaboliteRadius: 'appearance-highlighted-radius',
  extracellularMetaboliteRadius: 'appearance-extracellular-radius',
};

const APPEARANCE_COLOR_INPUTS = {
  normalMetaboliteFill: 'appearance-normal-fill',
  normalMetaboliteStroke: 'appearance-normal-stroke',
  highlightedFill: 'appearance-highlighted-fill',
  highlightedStroke: 'appearance-highlighted-stroke',
  extracellularFill: 'appearance-extracellular-fill',
  extracellularStroke: 'appearance-extracellular-stroke',
};

function nextCategoryValue(categories) {
  return categories.reduce((maximum, category) => {
    const value = Number(category.value);
    return Number.isFinite(value) ? Math.max(maximum, value) : maximum;
  }, -1) + 1;
}

function createCategoryRow(category) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input class="category-value" type="number" step="1" required></td>
    <td><input class="category-label" type="text" required></td>
    <td><input class="category-color" type="color" required></td>
    <td><input class="category-size" type="number" min="1" step="1" required></td>
    <td><input class="category-visible" type="checkbox" aria-label="Show in legend"></td>
    <td><button class="category-remove" type="button" aria-label="Remove category">Remove</button></td>
  `;
  row.querySelector('.category-value').value = category.value;
  row.querySelector('.category-label').value = category.label;
  row.querySelector('.category-color').value = category.color;
  row.querySelector('.category-size').value = category.size;
  row.querySelector('.category-visible').checked = category.visible !== false;
  row.querySelector('.category-remove').addEventListener('click', () => row.remove());
  return row;
}

function readCategoryRows(tableBody) {
  const categories = [...tableBody.querySelectorAll('tr')].map((row) => ({
    value: Number(row.querySelector('.category-value').value),
    label: row.querySelector('.category-label').value.trim(),
    color: row.querySelector('.category-color').value,
    size: Number(row.querySelector('.category-size').value),
    visible: row.querySelector('.category-visible').checked,
  }));

  if (categories.length === 0) throw new Error('Keep at least one reaction category.');
  if (categories.some((category) => !Number.isFinite(category.value))) {
    throw new Error('Every category needs a numeric value.');
  }
  if (categories.some((category) => !category.label)) {
    throw new Error('Every category needs a label.');
  }
  if (categories.some((category) => !Number.isFinite(category.size) || category.size <= 0)) {
    throw new Error('Every category needs a positive reaction-line size.');
  }
  const uniqueValues = new Set(categories.map((category) => category.value));
  if (uniqueValues.size !== categories.length) {
    throw new Error('Category values must be unique.');
  }
  return categories.sort((left, right) => left.value - right.value);
}

export function createInterface(state, callbacks) {
  const status = requiredElement('corinemap-status');
  const categoryDialog = requiredElement('category-dialog');
  const categoryForm = requiredElement('category-form');
  const categoryTableBody = requiredElement('category-table-body');
  const legendTitle = requiredElement('legend-title');
  const reactionInput = requiredElement('manual-reaction-id');
  const reactionList = requiredElement('reaction-id-list');
  const categorySelect = requiredElement('manual-category');
  const fluxTabs = requiredElement('flux-tabs');
  const datasetSummary = requiredElement('active-dataset-summary');
  const renameDatasetButton = requiredElement('rename-active-dataset');
  const removeDatasetButton = requiredElement('remove-active-dataset');
  const controlPanel = requiredElement('corinemap-panel');
  const controlPanelContent = requiredElement('corinemap-panel-content');
  const controlPanelToggle = requiredElement('toggle-corinemap-panel');
  const appearancePanel = requiredElement('appearance-panel');
  const appearanceForm = requiredElement('appearance-form');
  const appearanceValidation = requiredElement('appearance-validation');
  const openAppearanceButton = requiredElement('open-appearance-editor');
  const closeAppearanceButton = requiredElement('close-appearance-editor');
  const appearanceNumberInputs = Object.fromEntries(Object.entries(
    APPEARANCE_NUMBER_INPUTS,
  ).map(([key, id]) => [key, requiredElement(id)]));
  const appearanceColorInputs = Object.fromEntries(Object.entries(
    APPEARANCE_COLOR_INPUTS,
  ).map(([key, id]) => [key, requiredElement(id)]));
  const appearancePreviewScheduler = createAnimationFrameScheduler(
    () => callbacks.onAppearancePreview(readAppearanceForm(false)),
    (callback) => window.requestAnimationFrame(callback),
    (frame) => window.cancelAnimationFrame(frame),
  );

  function setStatus(message, level = 'info') {
    status.textContent = message;
    status.dataset.level = level;
  }

  function setPanelCollapsed(collapsed, persist = true) {
    controlPanel.classList.toggle('is-collapsed', collapsed);
    controlPanelContent.hidden = collapsed;
    controlPanelToggle.setAttribute('aria-expanded', String(!collapsed));
    controlPanelToggle.textContent = collapsed ? 'Show controls' : 'Hide';
    controlPanelToggle.title = collapsed
      ? 'Show Corinemap controls'
      : 'Hide Corinemap controls';
    if (!persist) return;
    try {
      window.localStorage.setItem(PANEL_STATE_KEY, collapsed ? 'true' : 'false');
    } catch {
      // The toggle still works when browser storage is unavailable.
    }
  }

  let initiallyCollapsed = false;
  try {
    initiallyCollapsed = window.localStorage.getItem(PANEL_STATE_KEY) === 'true';
  } catch {
    // Use the visible default when browser storage is unavailable.
  }
  setPanelCollapsed(initiallyCollapsed, false);
  controlPanelToggle.addEventListener('click', () => {
    setPanelCollapsed(!controlPanel.classList.contains('is-collapsed'));
  });

  function renderCategoryRows() {
    categoryTableBody.replaceChildren(
      ...state.categories.map((category) => createCategoryRow(category)),
    );
    legendTitle.value = state.legend.title;
  }

  function renderAppearanceForm(appearance) {
    Object.entries(appearanceNumberInputs).forEach(([key, input]) => {
      input.value = appearance[key];
      input.removeAttribute('aria-invalid');
    });
    Object.entries(appearanceColorInputs).forEach(([key, input]) => {
      input.value = appearance[key];
    });
    appearanceValidation.hidden = true;
    appearanceValidation.textContent = '';
  }

  function getAppearanceFormValues() {
    return {
      numberValues: Object.fromEntries(Object.entries(appearanceNumberInputs).map(
        ([key, input]) => [key, input.value],
      )),
      colorValues: Object.fromEntries(Object.entries(appearanceColorInputs).map(
        ([key, input]) => [key, input.value],
      )),
    };
  }

  function markInvalidAppearanceInputs(invalidKeys) {
    const invalid = new Set(invalidKeys);
    Object.entries(appearanceNumberInputs).forEach(([key, input]) => {
      if (invalid.has(key)) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
  }

  function readAppearanceForm(strict = false) {
    const { numberValues, colorValues } = getAppearanceFormValues();
    const baseAppearance = state.appearancePreview ?? state.appearance;
    if (strict) {
      const result = mergeAppearanceDraft(baseAppearance, numberValues, colorValues);
      markInvalidAppearanceInputs(result.invalidNumberKeys);
      return requireCompleteAppearanceDraft(baseAppearance, numberValues, colorValues);
    }
    return mergeAppearanceDraft(baseAppearance, numberValues, colorValues).appearance;
  }

  function cancelScheduledAppearancePreview() {
    appearancePreviewScheduler.cancel();
  }

  function scheduleAppearancePreview() {
    appearancePreviewScheduler.schedule();
  }

  function setAppearancePanelOpen(open) {
    appearancePanel.hidden = !open;
    appearancePanel.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('appearance-editor-open', open);
    if (open) closeAppearanceButton.focus({ preventScroll: true });
    else openAppearanceButton.focus({ preventScroll: true });
  }

  function cancelAppearanceEditing(announce = true) {
    cancelScheduledAppearancePreview();
    callbacks.onAppearanceCancel();
    setAppearancePanelOpen(false);
    if (announce) setStatus('Appearance changes canceled.');
  }

  function refreshCategorySelect() {
    categorySelect.replaceChildren(...state.categories.map((category) => {
      const option = document.createElement('option');
      option.value = category.value;
      option.textContent = `${category.value}: ${category.label}`;
      return option;
    }));
  }

  function refreshReactionIds(reactionIds) {
    reactionList.replaceChildren(...reactionIds.map((reactionId) => {
      const option = document.createElement('option');
      option.value = reactionId;
      return option;
    }));
  }

  function refreshDatasets() {
    const activeDataset = state.datasets.find(
      (dataset) => dataset.id === state.activeDatasetId,
    ) ?? null;

    if (state.datasets.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'flux-tabs-empty';
      empty.textContent = 'No flux datasets';
      fluxTabs.replaceChildren(empty);
    } else {
      fluxTabs.replaceChildren(...state.datasets.map((dataset) => {
        const button = document.createElement('button');
        const isActive = dataset.id === state.activeDatasetId;
        button.type = 'button';
        button.className = 'flux-tab';
        button.dataset.datasetId = dataset.id;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(isActive));
        button.tabIndex = isActive ? 0 : -1;
        button.textContent = dataset.name;
        button.title = `${Object.keys(dataset.reactionData).length} reaction assignments`;
        button.addEventListener('click', () => callbacks.onDatasetSelect(dataset.id));
        return button;
      }));
    }

    const assignmentCount = activeDataset
      ? Object.keys(activeDataset.reactionData).length
      : 0;
    datasetSummary.textContent = activeDataset ? `${assignmentCount} rows` : '';
    renameDatasetButton.disabled = !activeDataset;
    removeDatasetButton.disabled = !activeDataset;
  }

  requiredElement('open-category-editor').addEventListener('click', () => {
    renderCategoryRows();
    refreshCategorySelect();
    if (typeof categoryDialog.showModal === 'function') categoryDialog.showModal();
    else categoryDialog.setAttribute('open', '');
  });

  openAppearanceButton.addEventListener('click', () => {
    callbacks.onAppearanceCancel();
    renderAppearanceForm(state.appearance);
    setAppearancePanelOpen(true);
  });

  requiredElement('cancel-appearance-editor').addEventListener('click', () => {
    cancelAppearanceEditing();
  });
  closeAppearanceButton.addEventListener('click', () => cancelAppearanceEditing());

  requiredElement('reset-appearance').addEventListener('click', () => {
    cancelScheduledAppearancePreview();
    const defaults = callbacks.onAppearanceDefaults();
    renderAppearanceForm(defaults);
    callbacks.onAppearancePreview(defaults);
  });

  Object.values(appearanceNumberInputs).forEach((input) => {
    input.addEventListener('input', () => {
      if (parsePositiveAppearanceNumber(input.value) !== null) {
        input.removeAttribute('aria-invalid');
      }
      appearanceValidation.hidden = true;
      appearanceValidation.textContent = '';
      scheduleAppearancePreview();
    });
    input.addEventListener('blur', () => {
      if (parsePositiveAppearanceNumber(input.value) === null) {
        input.setAttribute('aria-invalid', 'true');
      }
    });
  });

  Object.values(appearanceColorInputs).forEach((input) => {
    input.addEventListener('input', scheduleAppearancePreview);
    input.addEventListener('change', scheduleAppearancePreview);
  });

  appearancePanel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    cancelAppearanceEditing();
  });

  appearanceForm.addEventListener('submit', (event) => {
    event.preventDefault();
    cancelScheduledAppearancePreview();
    try {
      callbacks.onAppearanceSave(readAppearanceForm(true));
      setAppearancePanelOpen(false);
      setStatus('Map appearance updated.');
    } catch (error) {
      appearanceValidation.textContent = error.message;
      appearanceValidation.hidden = false;
      appearancePanel.querySelector('[aria-invalid="true"]')?.focus();
    }
  });

  requiredElement('add-category').addEventListener('click', () => {
    const categories = [...categoryTableBody.querySelectorAll('tr')].map((row) => ({
      value: Number(row.querySelector('.category-value').value),
    }));
    categoryTableBody.append(createCategoryRow({
      value: nextCategoryValue(categories),
      label: 'New category',
      color: '#777777',
      size: 20,
      visible: true,
    }));
  });

  requiredElement('cancel-category-editor').addEventListener('click', () => categoryDialog.close());

  categoryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      callbacks.onCategoriesSave(readCategoryRows(categoryTableBody), legendTitle.value.trim());
      refreshCategorySelect();
      categoryDialog.close();
      setStatus('Reaction categories and legend updated.');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  requiredElement('assign-reaction').addEventListener('click', () => {
    const reactionId = reactionInput.value.trim();
    if (!reactionId) {
      setStatus('Choose or enter a reaction ID first.', 'error');
      return;
    }
    callbacks.onManualAssignment(reactionId, Number(categorySelect.value));
  });

  requiredElement('reaction-csv-input').addEventListener('change', async (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    if (files.length === 0) return;
    try {
      await callbacks.onReactionCsv(files);
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  renameDatasetButton.addEventListener('click', () => {
    const dataset = state.datasets.find(
      (candidate) => candidate.id === state.activeDatasetId,
    );
    if (!dataset) return;
    const requestedName = window.prompt('Name this flux dataset:', dataset.name);
    if (requestedName === null) return;
    if (!requestedName.trim()) {
      setStatus('The dataset name cannot be empty.', 'error');
      return;
    }
    callbacks.onDatasetRename(dataset.id, requestedName.trim());
  });

  removeDatasetButton.addEventListener('click', () => {
    const dataset = state.datasets.find(
      (candidate) => candidate.id === state.activeDatasetId,
    );
    if (!dataset) return;
    if (window.confirm(`Remove the “${dataset.name}” tab?`)) {
      callbacks.onDatasetRemove(dataset.id);
    }
  });

  requiredElement('workspace-input').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    try {
      await callbacks.onWorkspaceLoad(file);
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  requiredElement('save-workspace').addEventListener('click', callbacks.onWorkspaceSave);
  requiredElement('clear-reaction-data').addEventListener('click', callbacks.onClearReactionData);

  // Escher binds map shortcuts globally, including 0, 1, 2, Backspace, and
  // several letters. Keep those shortcuts on the map without letting them
  // swallow normal typing inside Corinemap's own controls.
  [controlPanel, categoryDialog, appearancePanel].forEach(isolateMapKeyboardShortcuts);

  refreshCategorySelect();
  refreshDatasets();
  return {
    setStatus,
    refreshCategorySelect,
    refreshReactionIds,
    refreshDatasets,
  };
}

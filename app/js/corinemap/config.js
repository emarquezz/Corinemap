export const DEFAULT_CATEGORIES = [
  { value: 0, label: 'No change', color: '#5e5e5e', size: 12, visible: true },
  { value: 1, label: 'Decreased expression', color: '#6785d0', size: 20, visible: true },
  { value: 2, label: 'Increased expression', color: '#d26ea9', size: 20, visible: true },
  { value: 3, label: 'Changed direction', color: '#b88f3e', size: 20, visible: false },
  { value: 4, label: 'Deactivated', color: '#e13e4e', size: 20, visible: false },
  { value: 5, label: 'Activated', color: '#64a85c', size: 20, visible: false },
];

export const APP_CONFIG = {
  mapUrl: './Corinebacterium_Glutamicum.json',
  modelUrl: './models/cglutamicum_mtl_escher.json',
  preloadedReactionDatasets: [
    {
      id: 'mannitol',
      name: 'Mannitol',
      url: './data/change_fluxes_mnl.csv',
    },
    {
      id: 'xylose',
      name: 'Xylose',
      url: './data/change_fluxes_xyl.csv',
    },
  ],
  builderOptions: {
    menu: 'all',
    fill_screen: true,
    identifiers_on_map: 'bigg_id',
    reaction_styles: ['abs', 'color', 'size'],
    enable_editing: true,
    enable_search: true,
    enable_tooltips: false,
  },
  metaboliteStyles: {
    highlightedIds: ['glc__D_e', 'mnl_e', 'xyl__D_e'],
  },
  appearance: {
    reactionLabelSize: 82,
    primaryMetaboliteLabelSize: 70,
    secondaryMetaboliteLabelSize: 54,
    highlightedMetaboliteLabelSize: 70,
    extracellularMetaboliteLabelSize: 70,
    primaryMetaboliteRadius: 20,
    secondaryMetaboliteRadius: 10,
    highlightedMetaboliteRadius: 27.5,
    extracellularMetaboliteRadius: 27.5,
    normalMetaboliteFill: '#e0865b',
    normalMetaboliteStroke: '#a24510',
    highlightedFill: '#359920',
    highlightedStroke: '#1e790b',
    extracellularFill: '#8254a5',
    extracellularStroke: '#3e0f62',
  },
  legend: {
    title: 'Reaction regulation',
    x: 4500,
    y: 1000,
    fontSize: 82,
  },
};

export function cloneDefaultCategories() {
  return DEFAULT_CATEGORIES.map((category) => ({ ...category }));
}

export function cloneDefaultAppearance() {
  return { ...APP_CONFIG.appearance };
}

export function categoriesToReactionScale(categories) {
  return categories
    .map(({ value, color, size }) => ({
      type: 'value',
      value: Number(value),
      color,
      size: Number(size),
    }))
    .sort((left, right) => left.value - right.value);
}

import { categoriesToReactionScale } from './config.js';

function isExtracellular(metaboliteId) {
  return typeof metaboliteId === 'string' && metaboliteId.endsWith('_e');
}

export function resolveMetaboliteAppearance(datum, highlighted, appearance) {
  const isHighlighted = highlighted.has(datum.bigg_id);
  const isExtracellularMetabolite = isExtracellular(datum.bigg_id);

  // Primary/secondary status controls the size hierarchy. Special metabolite
  // sizes only replace the primary size; secondary nodes such as h_e remain
  // compact, exactly as they did before appearance controls were introduced.
  let radius = appearance.secondaryMetaboliteRadius;
  let labelSize = appearance.secondaryMetaboliteLabelSize;
  if (datum.node_is_primary) {
    if (isHighlighted) {
      radius = appearance.highlightedMetaboliteRadius;
      labelSize = appearance.highlightedMetaboliteLabelSize;
    } else if (isExtracellularMetabolite) {
      radius = appearance.extracellularMetaboliteRadius;
      labelSize = appearance.extracellularMetaboliteLabelSize;
    } else {
      radius = appearance.primaryMetaboliteRadius;
      labelSize = appearance.primaryMetaboliteLabelSize;
    }
  }

  if (isHighlighted) {
    return {
      radius,
      labelSize,
      fill: appearance.highlightedFill,
      stroke: appearance.highlightedStroke,
    };
  }
  if (isExtracellularMetabolite) {
    return {
      radius,
      labelSize,
      fill: appearance.extracellularFill,
      stroke: appearance.extracellularStroke,
    };
  }
  return {
    radius,
    labelSize,
    fill: appearance.normalMetaboliteFill,
    stroke: appearance.normalMetaboliteStroke,
  };
}

function applyMetaboliteStyles(selection, highlightedIds, appearance) {
  const highlighted = new Set(highlightedIds);
  const draw = this;
  const identifiersOnMap = draw.settings.get_option('identifiers_on_map');

  selection.select('.node-circle')
    .attr('r', (datum) => {
      if (datum.node_type !== 'metabolite') return draw.settings.get_option('marker_radius');
      return resolveMetaboliteAppearance(datum, highlighted, appearance).radius;
    })
    .style('fill', (datum) => {
      if (datum.node_type !== 'metabolite') return null;
      return resolveMetaboliteAppearance(datum, highlighted, appearance).fill;
    })
    .style('stroke', (datum) => {
      if (datum.node_type !== 'metabolite') return null;
      return resolveMetaboliteAppearance(datum, highlighted, appearance).stroke;
    });

  selection.select('.node-label')
    .style('font-size', (datum) => (
      `${resolveMetaboliteAppearance(datum, highlighted, appearance).labelSize}px`
    ))
    .text((datum) => String(datum[identifiersOnMap] ?? datum.bigg_id ?? '')
      .trim()
      .replace(/_c$/, ''));
}

function applyReactionLabelStyles(selection, appearance) {
  selection.select('.reaction-label')
    .style('font-size', `${appearance.reactionLabelSize}px`);
}

export function updateReactionScale(builder, categories) {
  builder.settings.set_conditional('reaction_scale', categoriesToReactionScale(categories));
  builder.map.draw_all_reactions(true, false);
}

export function renderLegend(map, categories, legendState) {
  map.sel.select('#reaction-legend').remove();
  const visibleCategories = categories.filter((category) => category.visible !== false);
  if (visibleCategories.length === 0) return;

  const fontSize = Number(legendState.fontSize) || 82;
  const swatchWidth = fontSize * 1.4;
  const swatchHeight = fontSize * 0.7;
  const spacing = fontSize * 1.3;
  const padding = fontSize * 0.3;
  const titleHeight = fontSize * 1.8;
  const maxTextWidth = Math.max(
    ...visibleCategories.map((category) => category.label.length * fontSize * 0.55),
  );
  const width = padding * 2 + swatchWidth + 25 + maxTextWidth;
  const height = titleHeight + visibleCategories.length * spacing + padding;

  const legend = map.sel.append('g')
    .attr('id', 'reaction-legend')
    .attr('class', 'legend-svg')
    .attr('transform', `translate(${legendState.x}, ${legendState.y})`)
    .style('cursor', 'move');

  legend.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'white')
    .attr('stroke', '#333')
    .attr('stroke-width', 4)
    .attr('rx', 15);

  legend.append('text')
    .attr('x', width / 2)
    .attr('y', fontSize)
    .attr('text-anchor', 'middle')
    .style('font-family', 'sans-serif')
    .style('font-size', `${fontSize + 8}px`)
    .style('font-weight', 'bold')
    .style('fill', 'black')
    .text(legendState.title);

  visibleCategories.forEach((category, index) => {
    const row = legend.append('g')
      .attr('transform', `translate(${padding}, ${titleHeight + index * spacing})`);
    row.append('rect')
      .attr('width', swatchWidth)
      .attr('height', swatchHeight)
      .attr('fill', category.color)
      .attr('stroke', '#333')
      .attr('stroke-width', 2)
      .attr('rx', 8);
    row.append('text')
      .attr('x', swatchWidth + 25)
      .attr('y', swatchHeight / 2)
      .attr('dy', '0.35em')
      .style('font-family', 'sans-serif')
      .style('font-size', `${fontSize}px`)
      .style('font-weight', 'bold')
      .style('fill', 'black')
      .text(category.label);
  });

  legend.call(window.d3.drag()
    .on('drag', () => {
      legendState.x += window.d3.event.dx;
      legendState.y += window.d3.event.dy;
      legend.attr('transform', `translate(${legendState.x}, ${legendState.y})`);
    }));
}

export function redrawAppearance(builder) {
  builder.map.draw_all_nodes(false);
  builder.map.draw_all_reactions(true, false);
}

export function getActiveAppearance(state) {
  return state.appearancePreview ?? state.appearance;
}

export function installMapCustomization(builder, state, config) {
  const nodeCallback = function nodeCallback(selection) {
    applyMetaboliteStyles.call(
      this,
      selection,
      config.metaboliteStyles.highlightedIds,
      getActiveAppearance(state),
    );
  };
  const reactionLabelCallback = function reactionLabelCallback(selection) {
    applyReactionLabelStyles(selection, getActiveAppearance(state));
  };

  builder.map.draw.callback_manager.set('update_node.corinemap', nodeCallback);
  builder.map.draw.callback_manager.set(
    'update_reaction_label.corinemap',
    reactionLabelCallback,
  );
  builder.map.draw_all_nodes(false);
  updateReactionScale(builder, state.categories);
  renderLegend(builder.map, state.categories, state.legend);
}

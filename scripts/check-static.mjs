import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = resolve(repositoryRoot, 'app');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

let checkedAssetCount = 0;
let checkedInlineScriptCount = 0;

for (const htmlName of ['corinemap.html']) {
  const html = readFileSync(resolve(appRoot, htmlName), 'utf8');
  const assetReferences = [
    ...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi),
  ].map((match) => match[1]);
  checkedAssetCount += assetReferences.length;

  for (const reference of assetReferences) {
    if (/^(?:(?:https?:)?\/\/|data:)/i.test(reference)) continue;
    const pathWithoutQuery = reference.split(/[?#]/, 1)[0];
    check(existsSync(resolve(appRoot, pathWithoutQuery)), `${htmlName}: missing local asset ${reference}`);
  }

  const scriptSources = [
    ...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
  ].map((match) => match[1]);
  check(
    scriptSources.every((source) => extname(source.split(/[?#]/, 1)[0]).toLowerCase() !== '.css'),
    `${htmlName}: a CSS file is being loaded through a <script> tag.`,
  );
  const repeatedScriptSources = scriptSources.filter(
    (source, index) => scriptSources.indexOf(source) !== index,
  );
  check(
    repeatedScriptSources.length === 0,
    `${htmlName}: duplicate script sources ${repeatedScriptSources.join(', ')}`,
  );

  if (htmlName === 'corinemap.html') {
    const dependencyOrder = [
      'js/jquery.min.js',
      'js/bootstrap.min.js',
      'js/d3.v4.min.js',
      'js/escher.js',
      'js/corinemap/main.js',
    ];
    check(
      dependencyOrder.every((source) => scriptSources.includes(source)),
      `${htmlName}: missing a required Escher runtime dependency.`,
    );
    check(
      dependencyOrder.every((source, index) => (
        index === 0 || scriptSources.indexOf(dependencyOrder[index - 1]) < scriptSources.indexOf(source)
      )),
      `${htmlName}: required scripts must load in jQuery, Bootstrap, D3, Escher, application order.`,
    );
    for (const id of [
      'corinemap-panel',
      'corinemap-panel-content',
      'toggle-corinemap-panel',
      'open-appearance-editor',
      'appearance-panel',
      'appearance-form',
      'appearance-validation',
      'close-appearance-editor',
      'appearance-reaction-label-size',
      'appearance-primary-label-size',
      'appearance-secondary-label-size',
      'appearance-highlighted-label-size',
      'appearance-extracellular-label-size',
      'appearance-primary-radius',
      'appearance-secondary-radius',
      'appearance-highlighted-radius',
      'appearance-extracellular-radius',
      'appearance-normal-fill',
      'appearance-normal-stroke',
      'appearance-highlighted-fill',
      'appearance-highlighted-stroke',
      'appearance-extracellular-fill',
      'appearance-extracellular-stroke',
    ]) {
      check(
        new RegExp(`\\bid=["']${id}["']`).test(html),
        `${htmlName}: missing collapsible-panel element #${id}.`,
      );
    }
    check(
      /aria-controls=["']corinemap-panel-content["']/.test(html),
      `${htmlName}: panel toggle must identify the controlled content.`,
    );
    check(
      /<aside\b[^>]*\bid=["']appearance-panel["'][^>]*>/i.test(html),
      `${htmlName}: advanced appearance must use a modeless side panel.`,
    );
    check(
      /\baria-modal=["']false["']/.test(html),
      `${htmlName}: the appearance panel must leave the map interactive.`,
    );
  }
  check(
    !/\$\([^\n]*\)\.click\s*\(/.test(html),
    `${htmlName}: use namespaced .off(...).on(...) handlers instead of jQuery .click(...).`,
  );

  const inlineScripts = [
    ...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
  ].map((match) => match[1]);
  checkedInlineScriptCount += inlineScripts.length;
  for (const [index, source] of inlineScripts.entries()) {
    try {
      new Function(source);
    } catch (error) {
      failures.push(`${htmlName}: inline script ${index + 1} has invalid syntax: ${error.message}`);
    }
  }
}

const landingHtml = readFileSync(resolve(repositoryRoot, 'index.html'), 'utf8');
const landingReferences = [
  ...landingHtml.matchAll(/<(?:a|link|script|img)\b[^>]*\b(?:href|src)=["']([^"']+)["'][^>]*>/gi),
].map((match) => match[1]);
checkedAssetCount += landingReferences.length;
for (const reference of landingReferences) {
  if (/^(?:(?:https?:)?\/\/|data:|#|mailto:)/i.test(reference)) continue;
  const pathWithoutQuery = reference.split(/[?#]/, 1)[0];
  check(
    existsSync(resolve(repositoryRoot, pathWithoutQuery)),
    `root index.html: missing local target ${reference}`,
  );
}
check(/<title>[^<]*Corinemap/i.test(landingHtml), 'root index.html must use Corinemap branding.');
check(
  /href=["']app\/corinemap\.html["']/.test(landingHtml),
  'root index.html must link directly to the Corinemap application.',
);

for (const legacyPath of [
  'Escher-Trace Example Workspace.json',
  'app/index.html',
  'docs',
  'escher-trace.css',
  'homepage-media',
  'mkdocs.yml',
]) {
  check(
    !existsSync(resolve(repositoryRoot, legacyPath)),
    `legacy Escher-Trace path should be removed: ${legacyPath}`,
  );
}

for (const fileName of readdirSync(appRoot).filter((name) => name.endsWith('.json'))) {
  const mapPath = resolve(appRoot, fileName);
  try {
    const map = JSON.parse(readFileSync(mapPath, 'utf8'));
    check(Array.isArray(map) && map.length === 2, `${fileName}: expected an Escher [metadata, map] array.`);
    check(map?.[1]?.reactions && typeof map[1].reactions === 'object', `${fileName}: missing reactions.`);
    check(map?.[1]?.nodes && typeof map[1].nodes === 'object', `${fileName}: missing nodes.`);
  } catch (error) {
    failures.push(`${fileName}: invalid JSON (${error.message}).`);
  }
}

try {
  const escherSource = readFileSync(resolve(appRoot, 'js/escher.js'), 'utf8');
  new Function(escherSource);
  for (const sourceMapReference of escherSource.matchAll(/sourceMappingURL=([^\s]+)/g)) {
    check(
      existsSync(resolve(appRoot, 'js', sourceMapReference[1])),
      `app/js/escher.js references missing source map ${sourceMapReference[1]}.`,
    );
  }
} catch (error) {
  failures.push(`app/js/escher.js has invalid syntax: ${error.message}`);
}

const moduleRoot = resolve(appRoot, 'js/corinemap');
for (const fileName of readdirSync(moduleRoot).filter((name) => name.endsWith('.js'))) {
  const modulePath = resolve(moduleRoot, fileName);
  const moduleSource = readFileSync(modulePath, 'utf8');
  const syntaxCheck = spawnSync(process.execPath, ['--check', modulePath], { encoding: 'utf8' });
  check(syntaxCheck.status === 0, `${fileName}: ${syntaxCheck.stderr.trim()}`);
  for (const match of moduleSource.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    check(existsSync(resolve(moduleRoot, match[1])), `${fileName}: missing module ${match[1]}`);
  }
}

const uiSource = readFileSync(resolve(moduleRoot, 'ui.js'), 'utf8');
check(
  /event\.stopPropagation\(\)/.test(uiSource),
  'ui.js must prevent Escher map shortcuts from swallowing Corinemap input.',
);
check(
  /onAppearancePreview/.test(uiSource) && /requestAnimationFrame/.test(uiSource),
  'ui.js must provide animation-frame-coalesced appearance previews.',
);

const bootstrapSource = readFileSync(resolve(appRoot, 'js/bootstrap.min.js'), 'utf8');
check(
  /\.fn\.button\s*=/.test(bootstrapSource),
  'app/js/bootstrap.min.js does not include the button plugin required by Escher.',
);

const bootstrapCssPath = resolve(appRoot, 'css/bootstrap.min.css');
const bootstrapCss = readFileSync(bootstrapCssPath, 'utf8');
for (const match of bootstrapCss.matchAll(/url\(([^)]+)\)/g)) {
  const reference = match[1].replace(/["']/g, '').trim();
  if (/^(?:data:|https?:|#)/i.test(reference)) continue;
  const pathWithoutQuery = reference.split(/[?#]/, 1)[0];
  check(
    existsSync(resolve(dirname(bootstrapCssPath), pathWithoutQuery)),
    `app/css/bootstrap.min.css references missing asset ${reference}.`,
  );
}

const configPath = resolve(appRoot, 'js/corinemap/config.js');
const { APP_CONFIG } = await import(pathToFileURL(configPath));
check(
  typeof APP_CONFIG.modelUrl === 'string' && existsSync(resolve(appRoot, APP_CONFIG.modelUrl)),
  `config.js: missing default model ${APP_CONFIG.modelUrl}.`,
);
check(
  APP_CONFIG.appearance?.reactionLabelSize === 82,
  'config.js: the default reaction-label font size must be 82.',
);
check(
  Array.isArray(APP_CONFIG.preloadedReactionDatasets),
  'config.js: preloadedReactionDatasets must be an array.',
);
for (const dataset of APP_CONFIG.preloadedReactionDatasets ?? []) {
  check(
    typeof dataset.id === 'string' && dataset.id.trim() !== '',
    'config.js: every preloaded dataset needs an ID.',
  );
  check(
    typeof dataset.name === 'string' && dataset.name.trim() !== '',
    'config.js: every preloaded dataset needs a name.',
  );
  check(
    typeof dataset.url === 'string' && existsSync(resolve(appRoot, dataset.url)),
    `config.js: missing preloaded dataset ${dataset.url}.`,
  );
}

for (const relativePath of ['css/bootstrap.min.css', 'js/jquery.min.js', 'js/escher.js']) {
  const assetPath = resolve(appRoot, relativePath);
  const source = readFileSync(assetPath, 'utf8');
  for (const match of source.matchAll(/sourceMappingURL=([^\s*]+)/g)) {
    check(
      existsSync(resolve(dirname(assetPath), match[1])),
      `app/${relativePath} references missing source map ${match[1]}.`,
    );
  }
}

if (failures.length > 0) {
  console.error('Static checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Static checks passed (${checkedAssetCount} assets, ${checkedInlineScriptCount} inline scripts).`);
}

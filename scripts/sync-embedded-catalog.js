'use strict';

var fs = require('fs');
var path = require('path');
var projectRoot = path.resolve(__dirname, '..');
var catalog = readJson('app/config/channels.json');
var profiles = readJson('app/config/player-profiles.json');
var destination = path.join(projectRoot, 'app/js/config/EmbeddedCatalog.js');
var output = [
  '(function defineEmbeddedCatalog(namespace) {',
  "  'use strict';",
  '',
  '  /* Gerado por npm run sync-catalog. Não edite manualmente. */',
  '  namespace.config.embeddedProfiles = ' + indentJson(profiles) + ';',
  '',
  '  namespace.config.embeddedCatalog = ' + indentJson(catalog) + ';',
  '}(window.TblackTV));',
  ''
].join('\n');

fs.writeFileSync(destination, output, 'utf8');
console.log('Catálogo incorporado sincronizado: ' + destination);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'));
}

function indentJson(value) {
  return JSON.stringify(value, null, 2).replace(/\n/g, '\n  ');
}

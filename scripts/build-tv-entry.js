'use strict';

var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var packageJson = require(path.join(root, 'package.json'));
var templatePath = path.join(root, 'app', 'index.html');
var outputPath = path.join(root, packageJson.appPath);
var stylePaths = [
  'app/css/reset.css',
  'app/css/tokens.css',
  'app/css/layout.css',
  'app/css/components.css',
  'app/css/player.css'
];
var stylesheetPattern = /\s*<link rel="stylesheet" href="css\/(?:reset|tokens|layout|components|player)\.css\?v=[^"]+">/g;
var localScriptPattern = /<script src="(js\/[^"]+?)(?:\?v=[^"]+)?"><\/script>/g;
var html = fs.readFileSync(templatePath, 'utf8');
var styles = stylePaths.map(function readStyle(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').trim();
}).join('\n\n');

html = html.replace(stylesheetPattern, '');
html = html.replace('</head>', '  <style id="tblacktv-bundled-styles">\n' + styles + '\n  </style>\n</head>');
html = html.replace(/Número de teste: \d+/g, 'Número de teste: ' + packageJson.testBuild);
html = html.replace(/\?v=\d+\.\d+\.\d+/g, '?v=' + packageJson.version);
html = html.replace(localScriptPattern, function inlineLocalScript(match, relativePath) {
  var source = fs.readFileSync(path.join(root, 'app', relativePath), 'utf8').trim();
  return '<script data-tblacktv-source="' + relativePath + '">\n' + source + '\n</script>';
});

fs.writeFileSync(outputPath, html, 'utf8');
console.log('Generated ' + packageJson.appPath + ' with bundled CSS for test ' + packageJson.testBuild + '.');

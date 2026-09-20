'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const config = require('../app/config/channels.json');
assert.deepStrictEqual(config.channels, []);
assert.strictEqual(config.remotePlaylists.length, 1);
assert.strictEqual(config.remotePlaylists[0].url, 'https://ewertonmendes.github.io/tblack-iptv/playlist.m3u');

const requests = [], timers = [], elements = {};
const saved = { 'tblacktv.catalog.v1': 'old', 'tblacktv.remote-playlist.iptv-org-br': 'old', 'favorites': 'keep' };
const storage = {
  get length() { return Object.keys(saved).length; },
  key(i) { return Object.keys(saved)[i]; },
  removeItem(key) { delete saved[key]; },
  getItem() { throw new Error('Catalog must not read cache'); },
  setItem() { throw new Error('Catalog must not write cache'); }
};
function element(id) {
  return elements[id] || (elements[id] = { textContent: '', attributes: {},
    classList: { add() {}, remove() {} }, parentNode: { classList: { add() {}, remove() {} } },
    setAttribute(k, v) { this.attributes[k] = v; } });
}
function Request() { requests.push(this); }
Request.prototype.open = function(method, url) { this.url = url; };
Request.prototype.send = function() {};
Request.prototype.abort = function() {};
Request.prototype.reply = function(text, status = 200) {
  this.readyState = 4; this.status = status; this.responseText = text; this.onreadystatechange();
};
function Stub() {}
let controller;
const namespace = { config: { embeddedCatalog: config }, core: {}, services: {}, ui: {}, controllers: {} };
['EventBus', 'AppState', 'SpatialNavigation'].forEach(k => namespace.core[k] = Stub);
['PlayerFactory', 'SourceResolver', 'PlaybackService', 'FavoritesService'].forEach(k => namespace.services[k] = Stub);
['ClockView', 'ChannelGridView', 'SidebarView', 'PlayerView'].forEach(k => namespace.ui[k] = Stub);
Stub.prototype.start = function() {};
namespace.controllers.AppController = function(options) { controller = this; this.channels = []; this.options = options; };
namespace.controllers.AppController.prototype.start = function() {};
namespace.controllers.AppController.prototype.updateCatalog = function(channels) { this.channels = channels; };
const context = vm.createContext({ console, Date, XMLHttpRequest: Request,
  window: { TblackTV: namespace, localStorage: storage, setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {} },
  document: { readyState: 'complete', getElementById: element }
});
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context); }
function playlist(name) { return '#EXTM3U\n#EXTINF:-1,' + name + '\nhttps://example.com/' + name + '.m3u8'; }
load('app/js/services/RemotePlaylistCatalogService.js');
load('app/js/main.js');
assert.deepStrictEqual(saved, { favorites: 'keep' });
assert.strictEqual(requests.length, 1);
assert.match(requests[0].url, /^https:\/\/ewertonmendes.github.io\/tblack-iptv\/playlist.m3u\?tblacktv=\d+-1$/);
controller.onRefreshCatalog();
assert.strictEqual(requests.length, 1, 'Repeated refresh must not overlap');
requests[0].reply(playlist('Old'));
assert.strictEqual(controller.channels[0].name, 'Old');
controller.onRefreshCatalog();
assert.match(requests[1].url, /^https:\/\/ewertonmendes.github.io\/tblack-iptv\/playlist.m3u\?tblacktv=\d+-2$/);
assert.notStrictEqual(requests[1].url, requests[0].url, 'Every fetch must use a unique cache-busting URL');
requests[1].reply(playlist('New'));
assert.strictEqual(controller.channels.length, 1);
assert.strictEqual(controller.channels[0].name, 'New', 'Refresh replaces removed channels');
controller.onRefreshCatalog();
requests[2].reply('unavailable', 503);
assert.strictEqual(controller.channels.length, 0);
assert.match(elements['app-status'].textContent, /Falha/);
assert.strictEqual(elements['menu-refresh'].attributes['aria-disabled'], 'false');
controller.onRefreshCatalog();
requests[3].reply('<html>Invalid playlist</html>');
assert.strictEqual(controller.channels.length, 0);
assert.match(elements['app-status'].textContent, /Falha/);
controller.onRefreshCatalog();
timers[timers.length - 1]();
assert.strictEqual(elements['menu-refresh'].attributes['aria-disabled'], 'false');
requests[4].reply(playlist('Late'));
assert.strictEqual(controller.channels.length, 0, 'Late response after timeout is ignored');
controller.onRefreshCatalog();
requests[5].reply(playlist('Recovered'));
assert.strictEqual(controller.channels[0].name, 'Recovered');
load('app/js/main.js');
assert.strictEqual(requests.length, 7, 'Every startup fetches again');
assert.strictEqual(controller.channels.length, 0, 'Startup never displays old channels');
console.log('ok - startup, cache migration, refresh replacement, duplicate requests, HTTP errors, invalid data, timeout and retry');

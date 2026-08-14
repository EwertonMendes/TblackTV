'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var passed = 0;

function run(name, test) {
  test();
  passed += 1;
  console.log('ok - ' + name);
}

function load(context, relativePath) {
  var filename = path.join(root, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename: filename });
}

function runtime() {
  var windowObject = {
    TblackTV: { config: {}, core: {}, services: {}, adapters: {}, ui: {}, controllers: {} },
    setTimeout: function setTimeoutStub(callback) { return { callback: callback }; },
    clearTimeout: function clearTimeoutStub() {},
    addEventListener: function addEventListener() {},
    removeEventListener: function removeEventListener() {},
    focus: function focus() {}
  };
  var documentObject = {
    addEventListener: function addEventListener() {},
    removeEventListener: function removeEventListener() {}
  };
  return vm.createContext({
    window: windowObject,
    document: documentObject,
    console: console,
    Date: Date,
    Error: Error,
    Object: Object,
    Array: Array,
    String: String
  });
}

function iframe() {
  var listeners = {};
  return {
    style: {},
    attributes: {},
    focusCount: 0,
    contentWindow: {
      focusCount: 0,
      focus: function focus() { this.focusCount += 1; }
    },
    addEventListener: function addEventListener(name, callback) { listeners[name] = callback; },
    removeEventListener: function removeEventListener(name, callback) {
      if (listeners[name] === callback) { delete listeners[name]; }
    },
    setAttribute: function setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute: function removeAttribute(name) {
      delete this.attributes[name];
      if (name === 'src') { delete this.src; }
    },
    focus: function focus() { this.focusCount += 1; },
    dispatch: function dispatch(name) {
      if (listeners[name]) { listeners[name](); }
    },
    listeners: listeners
  };
}

run('iframe opens the configured URL without autoplay, sandbox or provider automation', function () {
  var context = runtime();
  var frame = iframe();
  var ready = 0;
  var Adapter;
  var player;

  load(context, 'app/js/services/adapters/IframePlayerAdapter.js');
  Adapter = context.window.TblackTV.adapters.IframePlayerAdapter;
  player = new Adapter(frame);
  player.load({ url: 'https://player.example/embed?id=1' }, {
    onReady: function onReady() { ready += 1; }
  });

  assert.strictEqual(frame.src, 'https://player.example/embed?id=1');
  assert.strictEqual(frame.attributes.sandbox, undefined);
  assert.strictEqual(frame.style.pointerEvents, 'none');
  assert.strictEqual(frame.attributes.tabindex, '-1');
  frame.dispatch('load');
  assert.strictEqual(ready, 1);
  assert.strictEqual(player.getState(), 'ready');
});

run('OK enables native iframe interaction and navigation can take it back', function () {
  var context = runtime();
  var frame = iframe();
  var started = 0;
  var ended = 0;
  var Adapter;
  var player;

  load(context, 'app/js/services/adapters/IframePlayerAdapter.js');
  Adapter = context.window.TblackTV.adapters.IframePlayerAdapter;
  player = new Adapter(frame);
  player.load({ url: '//player.example/embed' }, {
    onInteractionStarted: function onStarted(payload) {
      started += 1;
      assert.strictEqual(payload.persistent, true);
      assert.strictEqual(payload.durationMs, 0);
    },
    onInteractionEnded: function onEnded(payload) {
      ended += 1;
      assert.strictEqual(payload.reason, 'navigation');
    }
  });
  frame.dispatch('load');

  assert.strictEqual(player.reopenInteractionWindow(), true);
  assert.strictEqual(frame.style.pointerEvents, 'auto');
  assert.strictEqual(frame.attributes.tabindex, '0');
  assert.strictEqual(frame.focusCount, 1);
  assert.strictEqual(started, 1);
  assert.strictEqual(player.cancelInteractionWindow('navigation'), true);
  assert.strictEqual(frame.style.pointerEvents, 'none');
  assert.strictEqual(frame.attributes.tabindex, '-1');
  assert.strictEqual(ended, 1);
});

run('releasing an iframe removes handlers and embedded content', function () {
  var context = runtime();
  var frame = iframe();
  var ready = 0;
  var Adapter;
  var player;

  load(context, 'app/js/services/adapters/IframePlayerAdapter.js');
  Adapter = context.window.TblackTV.adapters.IframePlayerAdapter;
  player = new Adapter(frame);
  player.load({ url: 'https://player.example/embed' }, {
    onReady: function onReady() { ready += 1; }
  });
  player.release();
  frame.dispatch('load');

  assert.strictEqual(ready, 0);
  assert.strictEqual(frame.src, undefined);
  assert.strictEqual(frame.style.display, 'none');
  assert.strictEqual(player.getState(), 'released');
});

run('one physical Return burst returns Home without immediately exiting', function () {
  var context = runtime();
  var Controller;
  var controller;
  var closes = 0;
  var exits = 0;
  var state = { screen: 'player' };

  load(context, 'app/js/controllers/AppController.js');
  Controller = context.window.TblackTV.controllers.AppController;
  controller = new Controller({
    state: state,
    eventBus: {},
    navigation: {},
    gridView: {},
    playerView: {},
    playbackService: {},
    playerKeyCapture: null
  });
  controller.closePlayer = function closePlayer() {
    closes += 1;
    state.screen = 'home';
  };
  controller.exitApplication = function exitApplication() { exits += 1; };

  controller.onKeyDown({
    keyCode: 10009,
    preventDefault: function preventDefault() {},
    stopPropagation: function stopPropagation() {}
  });
  controller.onHardwareBack({
    type: 'backbutton',
    preventDefault: function preventDefault() {}
  });

  assert.strictEqual(closes, 1);
  assert.strictEqual(exits, 0);
  assert.strictEqual(state.screen, 'home');
});

run('focus recovery cannot call itself recursively', function () {
  var context = runtime();
  var Controller;
  var controller;
  var focusCalls = 0;
  var capture = {
    focus: function focus() {
      focusCalls += 1;
      controller.onApplicationFocus({ target: {} });
    }
  };

  load(context, 'app/js/controllers/AppController.js');
  Controller = context.window.TblackTV.controllers.AppController;
  controller = new Controller({
    state: { screen: 'player', iframeInteractionActive: false },
    eventBus: {},
    navigation: {},
    gridView: {},
    playerView: {},
    playbackService: {},
    playerKeyCapture: capture
  });
  controller.capturePlayerFocus();

  assert.strictEqual(focusCalls, 1);
  assert.strictEqual(controller.isCapturingPlayerFocus, false);
});

run('OK applies a search, closes the sidebar and returns focus to Home', function () {
  var context = runtime();
  var Controller;
  var controller;
  var stopped = 0;
  var collapsed = 0;
  var homeFocused = 0;
  var prevented = 0;
  var input = { value: 'espn' };
  var state = { screen: 'home', focusedChannelIndex: 0 };

  load(context, 'app/js/controllers/AppController.js');
  Controller = context.window.TblackTV.controllers.AppController;
  controller = new Controller({
    state: state,
    eventBus: {},
    navigation: {},
    gridView: { focus: function focus() {} },
    playerView: {},
    playbackService: {},
    playerKeyCapture: null,
    sidebarView: {
      stopSearchEditing: function stopSearchEditing() { stopped += 1; },
      setExpanded: function setExpanded(value) { if (!value) { collapsed += 1; } },
      clearFocus: function clearFocus() {},
      setFocusedItem: function setFocusedItem() {}
    },
    favoritesService: {},
    searchInput: input,
    homeFocusTarget: { focus: function focus() { homeFocused += 1; } },
    menuItems: {}
  });
  controller.searchEditing = true;
  controller.homeFocusArea = 'sidebar';
  controller.handleSearchEditingKey(13, {
    preventDefault: function preventDefault() { prevented += 1; }
  });

  assert.strictEqual(input.value, 'espn');
  assert.strictEqual(controller.searchEditing, false);
  assert.strictEqual(controller.homeFocusArea, 'grid');
  assert.strictEqual(stopped, 1);
  assert.strictEqual(collapsed, 1);
  assert.strictEqual(homeFocused, 1);
  assert.strictEqual(prevented, 1);
});

run('Return leaves the active search intact and Backspace edits natively', function () {
  var context = runtime();
  var Controller;
  var controller;
  var prevented = 0;
  var exits = 0;
  var input = { value: 'sportv' };
  var state = { screen: 'home', focusedChannelIndex: 0 };

  load(context, 'app/js/controllers/AppController.js');
  Controller = context.window.TblackTV.controllers.AppController;
  controller = new Controller({
    state: state,
    eventBus: {},
    navigation: {},
    gridView: { focus: function focus() {} },
    playerView: {},
    playbackService: {},
    playerKeyCapture: null,
    sidebarView: {
      stopSearchEditing: function stopSearchEditing() {},
      setExpanded: function setExpanded() {},
      clearFocus: function clearFocus() {},
      setFocusedItem: function setFocusedItem() {}
    },
    favoritesService: {},
    searchInput: input,
    homeFocusTarget: { focus: function focus() {} },
    menuItems: {}
  });
  controller.searchEditing = true;
  controller.exitApplication = function exitApplication() { exits += 1; };

  controller.onKeyDown({
    key: 'Backspace',
    keyCode: 8,
    target: input,
    preventDefault: function preventDefault() { prevented += 1; }
  });
  assert.strictEqual(controller.searchEditing, true);
  assert.strictEqual(prevented, 0);

  controller.handleSearchEditingKey(10009, {
    preventDefault: function preventDefault() { prevented += 1; }
  });
  assert.strictEqual(input.value, 'sportv');
  assert.strictEqual(controller.searchEditing, false);
  assert.strictEqual(prevented, 1);
  controller.onHardwareBack({
    type: 'backbutton',
    preventDefault: function preventDefault() {}
  });
  assert.strictEqual(exits, 0);
});

run('resolved playlists group providers and accept HLS text, DASH and video streams', function () {
  var context = runtime();
  var Service;
  var channels;
  var playlistContent = [
    '#EXTM3U',
    '#EXTINF:-1 tvg-id="sportv-arlequina",Sportv (Arlequina)',
    'https://cdn.example/embedtv/file.txt',
    '#EXTINF:-1 tvg-id="sportv-rdcanais",Sportv (RDCanais)',
    'https://cdn.example/live/channel.mpd',
    '#EXTINF:-1 tvg-id="sportv-meuplayer",Sportv (MeuPlayer)',
    'https://cdn.example/live/preview.mp4'
  ].join('\n');

  load(context, 'app/js/services/RemotePlaylistCatalogService.js');
  Service = context.window.TblackTV.services.RemotePlaylistCatalogService;
  new Service(function requestFactory() {
    return {
      readyState: 0,
      status: 0,
      responseText: '',
      open: function open() {},
      abort: function abort() {},
      send: function send() {
        this.readyState = 4;
        this.status = 200;
        this.responseText = playlistContent;
        this.onreadystatechange();
      }
    };
  }).load([{
    id: 'resolved',
    label: 'Resolvida',
    url: 'config/playlists/resolved.m3u',
    enabled: true
  }], [], {
    onSuccess: function onSuccess(result) { channels = result; }
  });

  assert.strictEqual(channels.length, 1);
  assert.strictEqual(channels[0].name, 'Sportv');
  assert.strictEqual(channels[0].category, 'Esportes');
  assert.strictEqual(channels[0].sources.filter(function onlyHls(source) {
    return source.type === 'hls';
  })[0].hlsPlayback, 'mse');
  assert.strictEqual(channels[0].sources.map(function sourceType(source) {
    return source.type;
  }).sort().join(','), 'dash,hls,video');
});

run('disguised HLS uses the MSE adapter before Samsung AVPlay', function () {
  var context = runtime();
  var Factory;
  var factory;
  var player;

  context.window.TblackTV.adapters.IframePlayerAdapter = function IframePlayerAdapter() {};
  context.window.TblackTV.adapters.HlsJsAdapter = function HlsJsAdapter(element) {
    this.element = element;
  };
  context.window.TblackTV.adapters.HlsJsAdapter.isSupported = function isSupported() { return true; };
  context.window.TblackTV.adapters.AvPlayAdapter = function AvPlayAdapter() {};
  context.window.TblackTV.adapters.AvPlayAdapter.isSupported = function isSupported() { return true; };
  context.window.TblackTV.adapters.Html5VideoAdapter = function Html5VideoAdapter() {};

  load(context, 'app/js/services/PlayerFactory.js');
  Factory = context.window.TblackTV.services.PlayerFactory;
  factory = new Factory({ html5Player: { id: 'video' }, avPlayer: { id: 'avplay' } });
  player = factory.create({
    type: 'hls',
    url: 'https://provider.example/channel/file.txt',
    hlsPlayback: 'mse'
  });

  assert.strictEqual(player instanceof context.window.TblackTV.adapters.HlsJsAdapter, true);
  assert.strictEqual(player.element.id, 'video');
});

run('the MSE adapter loads and releases a disguised HLS manifest', function () {
  var context = runtime();
  var latestHls;
  var listeners = {};
  var video = {
    style: {},
    paused: true,
    addEventListener: function addEventListener(name, callback) { listeners[name] = callback; },
    removeEventListener: function removeEventListener(name) { delete listeners[name]; },
    removeAttribute: function removeAttribute() {},
    play: function play() { this.paused = false; },
    pause: function pause() { this.paused = true; },
    load: function load() {}
  };
  var Adapter;
  var player;

  function FakeHls(config) {
    this.config = config;
    this.handlers = {};
    this.destroyed = false;
    latestHls = this;
  }
  FakeHls.Events = { MEDIA_ATTACHED: 'media', ERROR: 'error' };
  FakeHls.isSupported = function isSupported() { return true; };
  FakeHls.prototype.on = function on(name, callback) { this.handlers[name] = callback; };
  FakeHls.prototype.attachMedia = function attachMedia(element) {
    this.media = element;
    this.handlers.media();
  };
  FakeHls.prototype.loadSource = function loadSource(url) { this.url = url; };
  FakeHls.prototype.destroy = function destroy() { this.destroyed = true; };
  context.window.Hls = FakeHls;

  load(context, 'app/js/services/adapters/HlsJsAdapter.js');
  Adapter = context.window.TblackTV.adapters.HlsJsAdapter;
  player = new Adapter(video);
  player.load({ url: 'https://provider.example/channel/file.txt' }, {});

  assert.strictEqual(Adapter.isSupported(), true);
  assert.strictEqual(latestHls.url, 'https://provider.example/channel/file.txt');
  assert.strictEqual(latestHls.media, video);
  assert.strictEqual(latestHls.config.enableWorker, false);
  player.release();
  assert.strictEqual(latestHls.destroyed, true);
  assert.strictEqual(video.style.display, 'none');
});

run('the active catalog contains only direct HLS or M3U sources', function () {
  var catalog = JSON.parse(fs.readFileSync(path.join(root, 'app/config/channels.json'), 'utf8'));
  var iframeCount = 0;

  catalog.channels.forEach(function eachChannel(channel) {
    channel.sources.forEach(function eachSource(source) {
      if (source.type === 'iframe') { iframeCount += 1; }
      assert.strictEqual(source.type === 'hls' || source.type === 'm3u', true);
    });
  });
  assert.strictEqual(iframeCount, 0);
});

console.log('\n' + passed + ' tests passed.');

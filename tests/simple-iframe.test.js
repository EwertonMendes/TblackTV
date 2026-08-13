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

'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '..');
var tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

function loadScript(context, relativePath) {
  var filename = path.join(projectRoot, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename: filename });
}

function createRuntime() {
  var timers = [];
  var windowListeners = {};
  var documentListeners = {};
  var documentObject = {
    hidden: false,
    addEventListener: function addDocumentListener(name, callback) {
      documentListeners[name] = callback;
    },
    removeEventListener: function removeDocumentListener(name, callback) {
      if (documentListeners[name] === callback) {
        delete documentListeners[name];
      }
    }
  };
  var windowObject = {
    TblackTV: {
      config: {},
      core: {},
      services: {},
      adapters: {},
      ui: {},
      controllers: {}
    },
    setTimeout: function setTimeoutStub(callback, delay) {
      var timer = { callback: callback, delay: delay, cancelled: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout: function clearTimeoutStub(timer) {
      if (timer) {
        timer.cancelled = true;
      }
    },
    addEventListener: function addWindowListener(name, callback) {
      windowListeners[name] = callback;
    },
    removeEventListener: function removeWindowListener(name, callback) {
      if (windowListeners[name] === callback) {
        delete windowListeners[name];
      }
    },
    focus: function focusWindow() {}
  };
  var context = vm.createContext({
    window: windowObject,
    document: documentObject,
    console: console,
    JSON: JSON,
    Object: Object,
    Array: Array,
    Error: Error,
    encodeURIComponent: encodeURIComponent
  });

  return {
    context: context,
    window: windowObject,
    timers: timers,
    listeners: windowListeners,
    documentListeners: documentListeners,
    document: documentObject,
    runTimersThrough: function runTimersThrough(maxDelay) {
      timers.slice().forEach(function runTimer(timer) {
        if (!timer.cancelled && timer.delay <= maxDelay) {
          timer.cancelled = true;
          timer.callback();
        }
      });
    }
  };
}

function createIframe(contentDocument) {
  var listeners = {};
  var postedMessages = [];
  var parentNode = {
    focusCalls: 0,
    focus: function focusParent() { this.focusCalls += 1; }
  };
  var contentWindow = {
    postMessage: function postMessage(message, origin) {
      postedMessages.push({ message: message, origin: origin });
    },
    focus: function focusFrame() {}
  };

  return {
    style: {},
    attributes: {},
    contentDocument: contentDocument || null,
    contentWindow: contentWindow,
    parentNode: parentNode,
    postedMessages: postedMessages,
    addEventListener: function addEventListener(name, callback) { listeners[name] = callback; },
    removeEventListener: function removeEventListener(name, callback) {
      if (listeners[name] === callback) { delete listeners[name]; }
    },
    removeAttribute: function removeAttribute(name) { delete this.attributes[name]; },
    setAttribute: function setAttribute(name, value) { this.attributes[name] = value; },
    focus: function focusIframe() {},
    dispatch: function dispatch(name, event) {
      if (listeners[name]) { listeners[name](event || {}); }
    }
  };
}

function iframeProfile() {
  return {
    startup: {
      postMessageFormat: 'json',
      postMessages: [
        { message: { command: 'play' }, delaysMs: [0, 200] }
      ],
      verification: {
        type: 'postMessage',
        origin: 'https://player.example',
        eventField: 'event',
        eventValue: 'state',
        stateField: 'value',
        playingValues: ['playing']
      },
      timeoutMs: 1000,
      manualFallback: 'postMessage'
    },
    controls: {
      targetOrigin: 'https://player.example',
      play: { command: 'play' },
      pause: { command: 'pause' }
    }
  };
}

test('iframe load does not report ready and postMessage validates window and origin', function () {
  var runtime = createRuntime();
  var iframe = createIframe();
  var readyCount = 0;
  var Adapter;
  var adapter;

  loadScript(runtime.context, 'app/js/services/adapters/IframePlayerAdapter.js');
  Adapter = runtime.window.TblackTV.adapters.IframePlayerAdapter;
  adapter = new Adapter(iframe, iframeProfile());
  adapter.load({ url: 'https://player.example/embed' }, {
    onReady: function onReady() { readyCount += 1; }
  });
  assert.strictEqual(
    iframe.attributes.sandbox,
    'allow-scripts allow-same-origin'
  );
  assert.strictEqual(iframe.attributes.sandbox.indexOf('allow-popups'), -1);
  assert.strictEqual(iframe.attributes.sandbox.indexOf('allow-top-navigation'), -1);
  iframe.dispatch('load');

  assert.strictEqual(readyCount, 0);
  runtime.runTimersThrough(200);
  assert.strictEqual(iframe.postedMessages.length, 2);
  assert.strictEqual(iframe.postedMessages[0].message, JSON.stringify({ command: 'play' }));

  runtime.listeners.message({
    source: {},
    origin: 'https://player.example',
    data: { event: 'state', value: 'playing' }
  });
  runtime.listeners.message({
    source: iframe.contentWindow,
    origin: 'https://attacker.example',
    data: { event: 'state', value: 'playing' }
  });
  assert.strictEqual(readyCount, 0);

  runtime.listeners.message({
    source: iframe.contentWindow,
    origin: 'https://player.example',
    data: JSON.stringify({ event: 'state', value: 'playing' })
  });
  assert.strictEqual(readyCount, 1);
  assert.strictEqual(adapter.getState(), 'playing');
});

test('same-origin profile confirms playback only from the media playing event', function () {
  var runtime = createRuntime();
  var mediaListeners = {};
  var playCalls = 0;
  var readyCount = 0;
  var media = {
    paused: true,
    readyState: 4,
    play: function play() { playCalls += 1; },
    pause: function pause() {},
    addEventListener: function addEventListener(name, callback) { mediaListeners[name] = callback; },
    removeEventListener: function removeEventListener(name) { delete mediaListeners[name]; }
  };
  var frameDocument = {
    querySelector: function querySelector(selector) {
      return selector === 'video' ? media : null;
    }
  };
  var iframe = createIframe(frameDocument);
  var profile = {
    startup: {
      sameOrigin: { mediaSelector: 'video' },
      verification: { type: 'sameOriginMedia', mediaSelector: 'video' },
      timeoutMs: 1000,
      manualFallback: 'sameOrigin'
    }
  };
  var Adapter;
  var adapter;

  loadScript(runtime.context, 'app/js/services/adapters/IframePlayerAdapter.js');
  Adapter = runtime.window.TblackTV.adapters.IframePlayerAdapter;
  adapter = new Adapter(iframe, profile);
  adapter.load({ url: '/fixtures/paused-player.html' }, {
    onReady: function onReady() { readyCount += 1; }
  });
  iframe.dispatch('load');

  assert.strictEqual(playCalls, 1);
  assert.strictEqual(readyCount, 0);
  media.paused = false;
  mediaListeners.playing();
  assert.strictEqual(readyCount, 1);
  assert.strictEqual(adapter.getState(), 'playing');
});

test('opaque iframe opens a six-second interaction window and locks itself again', function () {
  var runtime = createRuntime();
  var iframe = createIframe();
  var blockedCount = 0;
  var readyCount = 0;
  var errorCount = 0;
  var started = [];
  var ended = [];
  var Adapter;
  var adapter;
  var profile = {
    startup: {
      securityMode: 'interaction-shield',
      verification: { type: 'none' },
      timeoutMs: 1000,
      manualFallback: 'timedInteraction',
      interactionWindowMs: 6000,
      manualCompletion: 'assume-playing'
    }
  };

  loadScript(runtime.context, 'app/js/services/adapters/IframePlayerAdapter.js');
  Adapter = runtime.window.TblackTV.adapters.IframePlayerAdapter;
  adapter = new Adapter(iframe, profile);
  adapter.load({ url: 'https://opaque.example/player' }, {
    onReady: function onReady() { readyCount += 1; },
    onAutoplayBlocked: function onBlocked() { blockedCount += 1; },
    onInteractionStarted: function onStarted(payload) { started.push(payload); },
    onInteractionEnded: function onEnded(payload) { ended.push(payload); },
    onError: function onError() { errorCount += 1; }
  });
  assert.strictEqual(iframe.src, 'https://opaque.example/player');
  assert.strictEqual(iframe.attributes.sandbox, undefined);
  iframe.dispatch('load');
  runtime.runTimersThrough(1000);

  assert.strictEqual(blockedCount, 1);
  assert.strictEqual(adapter.getState(), 'interaction-required');
  assert.strictEqual(adapter.activateFromUserGesture(), true);
  assert.strictEqual(readyCount, 0);
  assert.strictEqual(adapter.getState(), 'interaction-active');
  assert.strictEqual(iframe.attributes.tabindex, '0');
  assert.strictEqual(iframe.style.pointerEvents, 'auto');
  assert.strictEqual(started.length, 1);
  assert.strictEqual(started[0].durationMs, 6000);

  runtime.runTimersThrough(5999);
  assert.strictEqual(adapter.getState(), 'interaction-active');
  assert.strictEqual(readyCount, 0);

  runtime.runTimersThrough(6000);
  assert.strictEqual(readyCount, 1);
  assert.strictEqual(adapter.getState(), 'playing-unverified');
  assert.strictEqual(iframe.attributes.tabindex, '-1');
  assert.strictEqual(iframe.style.pointerEvents, 'none');
  assert.strictEqual(iframe.parentNode.focusCalls > 0, true);
  assert.strictEqual(ended[0].reason, 'timeout');
  assert.strictEqual(runtime.listeners.blur, undefined);
  assert.strictEqual(runtime.documentListeners.visibilitychange, undefined);

  assert.strictEqual(adapter.reopenInteractionWindow(), true);
  assert.strictEqual(adapter.getState(), 'interaction-active');
  runtime.listeners.blur();
  assert.strictEqual(adapter.getState(), 'playing-unverified');
  assert.strictEqual(readyCount, 1);
  assert.strictEqual(ended[1].reason, 'focus-lost');

  assert.strictEqual(adapter.reopenInteractionWindow(), true);
  assert.strictEqual(adapter.cancelInteractionWindow('navigation'), true);
  assert.strictEqual(adapter.getState(), 'interaction-required');
  assert.strictEqual(ended[2].reason, 'navigation');

  assert.strictEqual(adapter.reopenInteractionWindow(), true);
  runtime.document.hidden = true;
  runtime.documentListeners.visibilitychange();
  assert.strictEqual(adapter.getState(), 'playing-unverified');
  assert.strictEqual(ended[3].reason, 'focus-lost');
  assert.strictEqual(runtime.listeners.blur, undefined);
  assert.strictEqual(runtime.documentListeners.visibilitychange, undefined);
  assert.strictEqual(errorCount, 0);
});

test('releasing an iframe cancels delayed actions and ignores later events', function () {
  var runtime = createRuntime();
  var iframe = createIframe();
  var readyCount = 0;
  var Adapter;
  var adapter;

  loadScript(runtime.context, 'app/js/services/adapters/IframePlayerAdapter.js');
  Adapter = runtime.window.TblackTV.adapters.IframePlayerAdapter;
  adapter = new Adapter(iframe, iframeProfile());
  adapter.load({ url: 'https://player.example/embed' }, {
    onReady: function onReady() { readyCount += 1; }
  });
  iframe.dispatch('load');
  adapter.release();
  runtime.runTimersThrough(5000);

  assert.strictEqual(iframe.postedMessages.length, 0);
  assert.strictEqual(runtime.listeners.message, undefined);
  assert.strictEqual(readyCount, 0);
});

test('HTML5 play rejection is reported as autoplay blocked, not ready', function () {
  var runtime = createRuntime();
  var listeners = {};
  var blockedCount = 0;
  var readyCount = 0;
  var video = {
    style: {},
    paused: true,
    play: function play() {
      return { catch: function catchRejected(handler) { handler(new Error('blocked')); } };
    },
    pause: function pause() {},
    load: function load() {},
    removeAttribute: function removeAttribute() {},
    addEventListener: function addEventListener(name, callback) { listeners[name] = callback; },
    removeEventListener: function removeEventListener(name) { delete listeners[name]; }
  };
  var Adapter;
  var adapter;

  loadScript(runtime.context, 'app/js/services/adapters/Html5VideoAdapter.js');
  Adapter = runtime.window.TblackTV.adapters.Html5VideoAdapter;
  adapter = new Adapter(video);
  adapter.load({ url: 'https://media.example/live.m3u8' }, {
    onAutoplayBlocked: function onAutoplayBlocked() { blockedCount += 1; },
    onReady: function onReady() { readyCount += 1; }
  });

  assert.strictEqual(blockedCount, 1);
  assert.strictEqual(readyCount, 0);
});

test('PlaybackService falls back, restores the last activatable source and prompts once', function () {
  var runtime = createRuntime();
  var createdPlayers = [];
  var factory = {
    create: function create(source) {
      var player = {
        source: source,
        released: false,
        activated: false,
        callbacks: null,
        load: function load(unused, callbacks) {
          this.callbacks = callbacks;
          if (source.id === 'first') {
            callbacks.onAutoplayBlocked('blocked');
          } else {
            callbacks.onError('failed');
          }
        },
        release: function release() { this.released = true; },
        canActivateFromUserGesture: function canActivate() { return source.id === 'first'; },
        activateFromUserGesture: function activate() { this.activated = true; return true; },
        canToggle: function canToggle() { return false; },
        getName: function getName() { return 'fake'; }
      };
      createdPlayers.push(player);
      return player;
    }
  };
  var resolver = {
    resolve: function resolve(source, callbacks) {
      callbacks.onSuccess([source]);
      return function cancel() {};
    }
  };
  var events = [];
  var eventBus = {
    emit: function emit(name, payload) { events.push({ name: name, payload: payload }); }
  };
  var Service;
  var service;
  var prompts;

  loadScript(runtime.context, 'app/js/services/PlaybackService.js');
  Service = runtime.window.TblackTV.services.PlaybackService;
  service = new Service(factory, resolver, eventBus);
  service.playChannel({
    id: 'channel',
    sources: [
      { id: 'first', type: 'iframe', url: 'https://first.example' },
      { id: 'second', type: 'hls', url: 'https://second.example/live.m3u8' }
    ]
  }, 0);

  prompts = events.filter(function onlyPrompts(event) {
    return event.name === 'playback:userActionRequired';
  });
  assert.strictEqual(createdPlayers.length, 3);
  assert.strictEqual(prompts.length, 1);
  assert.strictEqual(prompts[0].payload.message, 'OK para iniciar esta fonte');
  assert.strictEqual(service.activateCurrentSource(), true);
  assert.strictEqual(createdPlayers[2].activated, true);

  service.stop();
  assert.strictEqual(createdPlayers[2].released, true);
});

test('manual activation failure becomes an error instead of reopening the prompt', function () {
  var runtime = createRuntime();
  var callbacks;
  var player = {
    load: function load(unused, handlers) {
      callbacks = handlers;
      handlers.onAutoplayBlocked('blocked');
    },
    release: function release() {},
    canActivateFromUserGesture: function canActivate() { return true; },
    activateFromUserGesture: function activate() { return true; },
    canToggle: function canToggle() { return false; },
    getName: function getName() { return 'fake'; }
  };
  var factory = { create: function create() { return player; } };
  var resolver = {
    resolve: function resolve(source, handlers) {
      handlers.onSuccess([source]);
      return function cancel() {};
    }
  };
  var events = [];
  var eventBus = { emit: function emit(name, payload) { events.push({ name: name, payload: payload }); } };
  var Service;
  var service;

  loadScript(runtime.context, 'app/js/services/PlaybackService.js');
  Service = runtime.window.TblackTV.services.PlaybackService;
  service = new Service(factory, resolver, eventBus);
  service.playChannel({ sources: [{ id: 'only', type: 'iframe', url: 'https://only.example' }] }, 0);
  assert.strictEqual(service.activateCurrentSource(), true);
  callbacks.onError('manual failed');

  assert.strictEqual(events.filter(function isPrompt(event) {
    return event.name === 'playback:userActionRequired';
  }).length, 1);
  assert.strictEqual(events.filter(function isError(event) {
    return event.name === 'playback:error';
  }).length, 1);
});

test('PlaybackService exposes interaction events and reopens an opaque source with OK', function () {
  var runtime = createRuntime();
  var callbacks;
  var active = false;
  var ready = false;
  var createCount = 0;
  var player = {
    load: function load(unused, handlers) {
      callbacks = handlers;
      handlers.onAutoplayBlocked('blocked');
    },
    release: function release() {},
    canActivateFromUserGesture: function canActivate() { return true; },
    usesTimedInteraction: function usesTimedInteraction() { return true; },
    activateFromUserGesture: function activate() {
      active = true;
      callbacks.onInteractionStarted({ durationMs: 6000 });
      return true;
    },
    canReopenInteractionWindow: function canReopen() { return ready && !active; },
    reopenInteractionWindow: function reopen() {
      active = true;
      callbacks.onInteractionStarted({ durationMs: 6000 });
      return true;
    },
    cancelInteractionWindow: function cancel(reason) {
      if (!active) { return false; }
      active = false;
      callbacks.onInteractionEnded({ reason: reason });
      return true;
    },
    canToggle: function canToggle() { return false; },
    getName: function getName() { return 'fake opaque'; }
  };
  var factory = { create: function create() { createCount += 1; return player; } };
  var resolver = {
    resolve: function resolve(source, handlers) {
      handlers.onSuccess([source]);
      return function cancel() {};
    }
  };
  var events = [];
  var eventBus = { emit: function emit(name, payload) { events.push({ name: name, payload: payload }); } };
  var Service;
  var service;

  loadScript(runtime.context, 'app/js/services/PlaybackService.js');
  Service = runtime.window.TblackTV.services.PlaybackService;
  service = new Service(factory, resolver, eventBus);
  service.playChannel({ sources: [
    { id: 'opaque', type: 'iframe', url: 'https://opaque.example' },
    { id: 'backup', type: 'iframe', url: 'https://backup.example' }
  ] }, 0);

  assert.strictEqual(createCount, 1);
  assert.strictEqual(events.filter(function isPrompt(event) { return event.name === 'playback:userActionRequired'; }).length, 1);
  assert.strictEqual(service.activateCurrentSource(), true);
  assert.strictEqual(service.isInteractionWindowActive(), true);
  assert.strictEqual(events.filter(function isReady(event) { return event.name === 'playback:ready'; }).length, 0);
  assert.strictEqual(events.filter(function isStarted(event) { return event.name === 'playback:interactionStarted'; }).length, 1);

  active = false;
  ready = true;
  callbacks.onInteractionEnded({ reason: 'timeout' });
  callbacks.onReady();
  assert.strictEqual(service.isInteractionWindowActive(), false);
  assert.strictEqual(service.toggle(), true);
  assert.strictEqual(service.isInteractionWindowActive(), true);
  assert.strictEqual(service.endInteractionWindow('navigation'), true);
  assert.strictEqual(service.isInteractionWindowActive(), false);
});

test('embedded catalog stays synchronized with the editable JSON files', function () {
  var runtime = createRuntime();
  var embeddedCatalog;
  var embeddedProfiles;
  var catalog = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app/config/channels.json'), 'utf8'));
  var profiles = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app/config/player-profiles.json'), 'utf8'));

  loadScript(runtime.context, 'app/js/config/EmbeddedCatalog.js');
  embeddedCatalog = JSON.parse(JSON.stringify(runtime.window.TblackTV.config.embeddedCatalog));
  embeddedProfiles = JSON.parse(JSON.stringify(runtime.window.TblackTV.config.embeddedProfiles));

  assert.deepStrictEqual(embeddedCatalog, catalog);
  assert.deepStrictEqual(embeddedProfiles, profiles);
});

test('CatalogService uses the embedded catalog when a DNS request hangs', function () {
  var runtime = createRuntime();
  var request;
  var result = null;
  var failure = null;
  var Service;
  var service;

  loadScript(runtime.context, 'app/js/config/EmbeddedCatalog.js');
  loadScript(runtime.context, 'app/js/services/CatalogService.js');
  request = {
    readyState: 1,
    status: 0,
    aborted: false,
    open: function open() {},
    send: function send() {},
    abort: function abort() { this.aborted = true; }
  };
  Service = runtime.window.TblackTV.services.CatalogService;
  service = new Service('channels.json', 'profiles.json', function requestFactory() {
    return request;
  }, {
    catalog: runtime.window.TblackTV.config.embeddedCatalog,
    profiles: runtime.window.TblackTV.config.embeddedProfiles
  });

  service.load(function onSuccess(payload) { result = payload; }, function onError(message) { failure = message; });
  assert.strictEqual(result, null);
  runtime.runTimersThrough(3499);
  assert.strictEqual(result, null);
  runtime.runTimersThrough(3500);

  assert.strictEqual(failure, null);
  assert.strictEqual(result.origin, 'embedded');
  assert.strictEqual(result.channels.length, 7);
  assert.strictEqual(request.aborted, true);
});

test('synchronous player failures become playback errors without escaping the service', function () {
  var runtime = createRuntime();
  var events = [];
  var releaseCount = 0;
  var factory = {
    create: function create() {
      return {
        load: function load() { throw new Error('player exploded'); },
        release: function release() { releaseCount += 1; },
        canActivateFromUserGesture: function canActivate() { return false; },
        canToggle: function canToggle() { return false; },
        getName: function getName() { return 'broken'; }
      };
    }
  };
  var resolver = {
    resolve: function resolve(source, handlers) {
      handlers.onSuccess([source]);
      return function cancel() {};
    }
  };
  var Service;
  var service;

  loadScript(runtime.context, 'app/js/services/PlaybackService.js');
  Service = runtime.window.TblackTV.services.PlaybackService;
  service = new Service(factory, resolver, {
    emit: function emit(name, payload) { events.push({ name: name, payload: payload }); }
  });

  assert.doesNotThrow(function playBrokenSource() {
    service.playChannel({ sources: [{ id: 'broken', type: 'video', url: 'broken:' }] }, 0);
  });
  assert.strictEqual(events.filter(function isError(event) { return event.name === 'playback:error'; }).length, 1);
  assert.strictEqual(releaseCount, 1);
});

test('TV entry point fixes the logical viewport and versions every local asset', function () {
  var packageDocument = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  var html = fs.readFileSync(path.join(projectRoot, 'app/index.html'), 'utf8');
  var assetPattern = /(?:src|href)="((?:css|js)\/[^\"]+)"/g;
  var match;
  var assets = [];

  assert.strictEqual(html.indexOf('content="width=1920,') >= 0, true);
  assert.strictEqual(html.indexOf('id="test-build-number"') >= 0, true);
  assert.strictEqual(html.indexOf('Número de teste: 1') >= 0, true);
  while ((match = assetPattern.exec(html))) {
    assets.push(match[1]);
  }
  assert.strictEqual(assets.length > 0, true);
  assets.forEach(function assertVersioned(asset) {
    assert.strictEqual(asset.indexOf('?v=' + packageDocument.version) > 0, true);
  });
});

test('TV styles avoid unsupported inset and flex gap declarations', function () {
  var cssFiles = ['app/css/layout.css', 'app/css/components.css', 'app/css/player.css'];
  var css = cssFiles.map(function readCss(relativePath) {
    return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  }).join('\n');

  assert.strictEqual(/(^|[;{]\s*)inset\s*:/m.test(css), false);
  assert.strictEqual(/(^|[;{]\s*)gap\s*:/m.test(css), false);
});

test('AVPlay uses Samsung fixed 1920x1080 multimedia coordinates', function () {
  var runtime = createRuntime();
  var displayRect = null;
  var Adapter;
  var adapter;

  runtime.window.innerWidth = 1280;
  runtime.window.innerHeight = 720;
  runtime.window.webapis = {
    avplay: {
      open: function open() {},
      setDisplayRect: function setDisplayRect(x, y, width, height) {
        displayRect = [x, y, width, height];
      },
      setDisplayMethod: function setDisplayMethod() {},
      setStreamingProperty: function setStreamingProperty() {},
      setListener: function setListener() {},
      prepareAsync: function prepareAsync(onSuccess) { onSuccess(); },
      play: function play() {},
      getState: function getState() { return 'NONE'; }
    }
  };

  loadScript(runtime.context, 'app/js/services/adapters/AvPlayAdapter.js');
  Adapter = runtime.window.TblackTV.adapters.AvPlayAdapter;
  adapter = new Adapter({
    getBoundingClientRect: function getBoundingClientRect() {
      return { left: 0, top: 0, width: 1280, height: 720 };
    }
  });
  adapter.load({ url: 'https://media.example/live.m3u8' }, {});

  assert.deepStrictEqual(displayRect, [0, 0, 1920, 1080]);
});

function runAll() {
  var failures = 0;

  tests.forEach(function runTest(item) {
    try {
      item.run();
      console.log('PASS ' + item.name);
    } catch (error) {
      failures += 1;
      console.error('FAIL ' + item.name);
      console.error(error && error.stack ? error.stack : error);
    }
  });

  if (failures) {
    process.exitCode = 1;
    return;
  }
  console.log('\n' + tests.length + ' tests passed.');
}

runAll();

(function defineIframePlayerAdapter(namespace) {
  'use strict';

  var DEFAULT_START_TIMEOUT_MS = 6000;
  var DEFAULT_MANUAL_TIMEOUT_MS = 6000;
  var DEFAULT_INTERACTION_WINDOW_MS = 6000;
  var SAFE_SANDBOX = 'allow-scripts allow-same-origin';

  function IframePlayerAdapter(iframeElement, profile) {
    this.iframe = iframeElement;
    this.profile = profile || {};
    this.source = null;
    this.callbacks = null;
    this.state = 'idle';
    this.isPlaying = false;
    this.startTimeout = null;
    this.manualTimeout = null;
    this.interactionTimeout = null;
    this.focusRestoreTimeout = null;
    this.focusGuardTimeouts = [];
    this.actionTimeouts = [];
    this.boundLoad = null;
    this.boundError = null;
    this.boundMessage = null;
    this.boundWindowBlur = null;
    this.boundVisibilityChange = null;
    this.sameOriginMedia = null;
    this.boundMediaHandlers = null;
    this.securityMode = 'sandbox';
    this.interactionActive = false;
    this.readyReported = false;
  }

  IframePlayerAdapter.prototype.load = function load(source, callbacks) {
    var self = this;
    var startup;
    var sourceUrl;

    if (this.source || this.callbacks || this.boundLoad) {
      this.release();
    }
    this.source = source;
    this.callbacks = callbacks || {};
    this.state = 'loading';
    this.interactionActive = false;
    this.readyReported = false;
    startup = getStartup(this.profile);
    sourceUrl = buildUrl(source.url, startup.urlParams);
    this.securityMode = startup.securityMode || 'sandbox';
    this.boundLoad = function onIframeLoad() {
      if (self.state !== 'loading') {
        return;
      }
      self.state = 'starting';
      self.disableInteraction();
      self.restoreApplicationFocus();
      invoke(self.callbacks.onBuffering, true);
      self.prepareVerification();
      if (self.state === 'error' || self.state === 'playing' || self.state === 'playing-unverified') {
        return;
      }
      self.runStartupActions(false);
      if (self.state === 'error' || self.state === 'playing' || self.state === 'playing-unverified') {
        return;
      }
      self.armStartTimeout(false);
    };
    this.boundError = function onIframeError() {
      self.fail('O player incorporado não pôde ser carregado.');
    };
    this.boundMessage = function onWindowMessage(event) {
      self.handleWindowMessage(event);
    };

    this.iframe.addEventListener('load', this.boundLoad);
    this.iframe.addEventListener('error', this.boundError);
    window.addEventListener('message', this.boundMessage);
    if (this.securityMode === 'sandbox') {
      this.iframe.setAttribute('sandbox', SAFE_SANDBOX);
    } else {
      this.iframe.removeAttribute('sandbox');
    }
    this.iframe.style.display = 'block';
    this.disableInteraction();
    this.iframe.src = sourceUrl;
    this.scheduleApplicationFocusGuards();
  };

  IframePlayerAdapter.prototype.runStartupActions = function runStartupActions(fromUserGesture) {
    var startup = getStartup(this.profile);

    if (startup.sameOrigin) {
      this.trySameOriginPlay(startup.sameOrigin, fromUserGesture);
    }
    this.schedulePostMessages(startup.postMessages || [], fromUserGesture);
  };

  IframePlayerAdapter.prototype.prepareVerification = function prepareVerification() {
    var verification = getVerification(this.profile);

    if (verification.type === 'sameOriginMedia') {
      this.bindSameOriginMedia(verification.mediaSelector);
    }
  };

  IframePlayerAdapter.prototype.bindSameOriginMedia = function bindSameOriginMedia(selector) {
    var self = this;
    var frameDocument;
    var media;

    try {
      frameDocument = this.iframe.contentDocument;
      media = frameDocument ? frameDocument.querySelector(selector) : null;
    } catch (error) {
      this.fail('O perfil exige acesso same-origin, mas o iframe pertence a outro domínio.');
      return;
    }

    if (!media) {
      this.fail('O elemento de mídia configurado não foi encontrado no iframe.');
      return;
    }

    this.sameOriginMedia = media;
    this.boundMediaHandlers = {
      playing: function onPlaying() { self.markPlaying(); },
      pause: function onPause() {
        self.isPlaying = false;
        invoke(self.callbacks.onPlayStateChange, false);
      },
      error: function onMediaError() { self.fail('A mídia incorporada informou um erro.'); }
    };

    media.addEventListener('playing', this.boundMediaHandlers.playing);
    media.addEventListener('pause', this.boundMediaHandlers.pause);
    media.addEventListener('error', this.boundMediaHandlers.error);

    if (!media.paused && media.readyState >= 2) {
      this.markPlaying();
    }
  };

  IframePlayerAdapter.prototype.trySameOriginPlay = function trySameOriginPlay(config, fromUserGesture) {
    var frameDocument;
    var media;
    var playButton;
    var promise;

    try {
      frameDocument = this.iframe.contentDocument;
      media = this.sameOriginMedia || (frameDocument && config.mediaSelector ? frameDocument.querySelector(config.mediaSelector) : null);
      playButton = frameDocument && config.playSelector ? frameDocument.querySelector(config.playSelector) : null;
    } catch (error) {
      if (fromUserGesture) {
        this.fail('Não é possível controlar este iframe por acesso same-origin.');
      }
      return;
    }

    if (media && typeof media.play === 'function') {
      try {
        promise = media.play();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(function ignoreBlockedPromise() {});
        }
      } catch (error) {}
    }

    if (playButton && typeof playButton.click === 'function') {
      try { playButton.click(); } catch (error) {}
    }
  };

  IframePlayerAdapter.prototype.schedulePostMessages = function schedulePostMessages(actions, fromUserGesture) {
    var self = this;

    actions.forEach(function scheduleAction(action) {
      action.delaysMs.forEach(function scheduleDelay(delay) {
        if (fromUserGesture && delay === 0) {
          self.sendMessage(action.message);
          return;
        }
        self.actionTimeouts.push(window.setTimeout(function sendScheduledMessage() {
          self.sendMessage(action.message);
        }, delay));
      });
    });
  };

  IframePlayerAdapter.prototype.sendMessage = function sendMessage(message) {
    var targetOrigin = getTargetOrigin(this.profile);
    var payload = message;

    if (!message || !targetOrigin || !this.iframe.contentWindow) {
      return;
    }
    if (getStartup(this.profile).postMessageFormat === 'json') {
      try {
        payload = JSON.stringify(message);
      } catch (error) {
        return;
      }
    }
    try {
      this.iframe.contentWindow.postMessage(payload, targetOrigin);
    } catch (error) {}
  };

  IframePlayerAdapter.prototype.handleWindowMessage = function handleWindowMessage(event) {
    var verification = getVerification(this.profile);
    var payload;

    if (verification.type !== 'postMessage') {
      return;
    }
    if (event.source !== this.iframe.contentWindow || event.origin !== verification.origin) {
      return;
    }

    payload = parseMessageData(event.data);
    if (!payload || payload[verification.eventField] !== verification.eventValue) {
      return;
    }
    if (verification.stateField && !contains(verification.playingValues, payload[verification.stateField])) {
      return;
    }
    this.markPlaying();
  };

  IframePlayerAdapter.prototype.armStartTimeout = function armStartTimeout(manual) {
    var self = this;
    var startup = getStartup(this.profile);
    var timeoutMs = manual ? (startup.manualTimeoutMs || DEFAULT_MANUAL_TIMEOUT_MS) : (startup.timeoutMs || this.source.timeoutMs || DEFAULT_START_TIMEOUT_MS);

    if (this.startTimeout) {
      window.clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    if (this.manualTimeout) {
      window.clearTimeout(this.manualTimeout);
      this.manualTimeout = null;
    }
    this.startTimeout = window.setTimeout(function onStartTimeout() {
      if (self.state !== 'starting') {
        return;
      }
      if (manual) {
        self.disableInteraction();
        self.fail('O player incorporado não confirmou a reprodução após a ativação.');
      } else {
        self.markAutoplayBlocked('A fonte carregou, mas não confirmou o início automático.');
      }
    }, timeoutMs);
  };

  IframePlayerAdapter.prototype.markPlaying = function markPlaying(keepInteraction, reportPlayState) {
    if (this.state === 'playing' || this.state === 'released') {
      return;
    }

    if (this.interactionActive) {
      this.finishInteractionWindow('verified', false);
    }
    this.clearStartTimeouts();
    if (!keepInteraction) {
      this.disableInteraction();
    }
    this.state = 'playing';
    this.isPlaying = true;
    if (!this.readyReported) {
      this.readyReported = true;
      invoke(this.callbacks.onReady);
    }
    invoke(this.callbacks.onBuffering, false);
    if (reportPlayState !== false) {
      invoke(this.callbacks.onPlayStateChange, true);
    }
  };

  IframePlayerAdapter.prototype.markAutoplayBlocked = function markAutoplayBlocked(message) {
    if (this.state === 'autoplay-blocked' || this.state === 'playing' || this.state === 'error' || this.state === 'released') {
      return;
    }

    this.clearStartTimeouts();
    this.state = getStartup(this.profile).manualFallback === 'timedInteraction' ? 'interaction-required' : 'autoplay-blocked';
    this.isPlaying = false;
    invoke(this.callbacks.onBuffering, false);
    invoke(this.callbacks.onAutoplayBlocked, message);
  };

  IframePlayerAdapter.prototype.fail = function fail(message) {
    if (this.state === 'error' || this.state === 'released') {
      return;
    }

    if (this.interactionActive) {
      this.finishInteractionWindow('cancelled', false);
    }
    this.clearStartTimeouts();
    this.disableInteraction();
    this.state = 'error';
    this.isPlaying = false;
    invoke(this.callbacks.onBuffering, false);
    invoke(this.callbacks.onError, message);
  };

  IframePlayerAdapter.prototype.activateFromUserGesture = function activateFromUserGesture() {
    var startup = getStartup(this.profile);
    var fallback = startup.manualFallback || 'none';

    if (!this.canActivateFromUserGesture()) {
      return false;
    }

    if (fallback === 'timedInteraction') {
      return this.beginInteractionWindow();
    }

    this.state = 'starting';
    invoke(this.callbacks.onBuffering, true);

    if (fallback === 'postMessage') {
      this.sendMessage(getControls(this.profile).play);
      this.runStartupActions(true);
    } else if (fallback === 'sameOrigin') {
      this.trySameOriginPlay(startup.sameOrigin || { mediaSelector: 'video' }, true);
    } else if (fallback === 'focus') {
      this.enableInteraction();
      invoke(this.callbacks.onManualInteraction, 'Use o controle do player para iniciar a transmissão.');
      if (startup.manualCompletion === 'assume-playing') {
        this.markPlaying(true, false);
        return true;
      }
    } else if (fallback === 'acknowledge') {
      this.disableInteraction();
      invoke(this.callbacks.onManualInteraction, 'Fonte ativa em modo protegido.');
      this.markPlaying(false, false);
      return true;
    }

    this.armStartTimeout(true);
    return true;
  };

  IframePlayerAdapter.prototype.canActivateFromUserGesture = function canActivateFromUserGesture() {
    return (getStartup(this.profile).manualFallback || 'none') !== 'none';
  };

  IframePlayerAdapter.prototype.beginInteractionWindow = function beginInteractionWindow() {
    var self = this;
    var startup = getStartup(this.profile);
    var durationMs = startup.interactionWindowMs || DEFAULT_INTERACTION_WINDOW_MS;

    if (startup.manualFallback !== 'timedInteraction' || this.interactionActive || this.state === 'released' || this.state === 'error') {
      return false;
    }

    this.clearStartTimeouts();
    this.clearFocusGuards();
    this.interactionActive = true;
    this.state = 'interaction-active';
    this.isPlaying = false;
    invoke(this.callbacks.onBuffering, false);
    this.enableInteraction();
    this.bindInteractionGuards();
    this.interactionTimeout = window.setTimeout(function onInteractionTimeout() {
      self.finishInteractionWindow('timeout', true);
    }, durationMs);
    invoke(this.callbacks.onInteractionStarted, { durationMs: durationMs });
    return true;
  };

  IframePlayerAdapter.prototype.finishInteractionWindow = function finishInteractionWindow(reason, complete) {
    var startup = getStartup(this.profile);
    var shouldAssumePlaying;

    if (!this.interactionActive) {
      return false;
    }

    if (this.interactionTimeout) {
      window.clearTimeout(this.interactionTimeout);
      this.interactionTimeout = null;
    }
    this.unbindInteractionGuards();
    this.interactionActive = false;
    this.disableInteraction();
    this.restoreApplicationFocus();
    shouldAssumePlaying = complete !== false && startup.manualCompletion === 'assume-playing';

    if (shouldAssumePlaying) {
      this.state = 'playing-unverified';
      this.isPlaying = true;
    } else if (this.state !== 'released' && this.state !== 'error') {
      this.state = 'interaction-required';
      this.isPlaying = false;
    }

    invoke(this.callbacks.onInteractionEnded, { reason: reason || 'cancelled' });

    if (shouldAssumePlaying) {
      if (!this.readyReported) {
        this.readyReported = true;
        invoke(this.callbacks.onReady);
      }
      invoke(this.callbacks.onBuffering, false);
    }
    return true;
  };

  IframePlayerAdapter.prototype.cancelInteractionWindow = function cancelInteractionWindow(reason) {
    return this.finishInteractionWindow(reason || 'cancelled', false);
  };

  IframePlayerAdapter.prototype.reopenInteractionWindow = function reopenInteractionWindow() {
    if (!this.canReopenInteractionWindow()) {
      return false;
    }
    return this.beginInteractionWindow();
  };

  IframePlayerAdapter.prototype.canReopenInteractionWindow = function canReopenInteractionWindow() {
    var fallback = getStartup(this.profile).manualFallback;
    return fallback === 'timedInteraction' && !this.interactionActive &&
      (this.state === 'interaction-required' || this.state === 'autoplay-blocked' || this.state === 'playing-unverified');
  };

  IframePlayerAdapter.prototype.isInteractionWindowActive = function isInteractionWindowActive() {
    return this.interactionActive;
  };

  IframePlayerAdapter.prototype.usesTimedInteraction = function usesTimedInteraction() {
    return getStartup(this.profile).manualFallback === 'timedInteraction';
  };

  IframePlayerAdapter.prototype.toggle = function toggle() {
    var controls = getControls(this.profile);
    var message;
    var promise;

    if (this.sameOriginMedia) {
      if (this.sameOriginMedia.paused) {
        promise = this.sameOriginMedia.play();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(function ignoreTogglePromise() {});
        }
        return true;
      }
      this.sameOriginMedia.pause();
      return false;
    }

    if (!this.canToggle()) {
      return this.isPlaying;
    }

    message = this.isPlaying ? controls.pause : controls.play;
    this.sendMessage(message);
    this.isPlaying = !this.isPlaying;
    invoke(this.callbacks.onPlayStateChange, this.isPlaying);
    return this.isPlaying;
  };

  IframePlayerAdapter.prototype.canToggle = function canToggle() {
    var controls = getControls(this.profile);
    return !!(this.sameOriginMedia || (controls && controls.targetOrigin && controls.play && controls.pause));
  };

  IframePlayerAdapter.prototype.stop = function stop() {
    var controls = getControls(this.profile);

    if (this.sameOriginMedia) {
      try { this.sameOriginMedia.pause(); } catch (error) {}
    } else if (controls && controls.pause && this.isPlaying) {
      this.sendMessage(controls.pause);
    }
    this.isPlaying = false;
  };

  IframePlayerAdapter.prototype.release = function release() {
    this.cancelInteractionWindow('cancelled');
    this.clearAllTimeouts();
    this.unbindInteractionGuards();
    this.unbindSameOriginMedia();

    if (this.boundLoad) {
      this.iframe.removeEventListener('load', this.boundLoad);
    }
    if (this.boundError) {
      this.iframe.removeEventListener('error', this.boundError);
    }
    if (this.boundMessage) {
      window.removeEventListener('message', this.boundMessage);
    }

    this.stop();
    this.disableInteraction();
    this.iframe.removeAttribute('src');
    this.iframe.style.display = 'none';
    this.boundLoad = null;
    this.boundError = null;
    this.boundMessage = null;
    this.callbacks = null;
    this.source = null;
    this.securityMode = 'sandbox';
    this.interactionActive = false;
    this.readyReported = false;
    this.state = 'released';
  };

  IframePlayerAdapter.prototype.unbindSameOriginMedia = function unbindSameOriginMedia() {
    if (this.sameOriginMedia && this.boundMediaHandlers) {
      this.sameOriginMedia.removeEventListener('playing', this.boundMediaHandlers.playing);
      this.sameOriginMedia.removeEventListener('pause', this.boundMediaHandlers.pause);
      this.sameOriginMedia.removeEventListener('error', this.boundMediaHandlers.error);
    }
    this.sameOriginMedia = null;
    this.boundMediaHandlers = null;
  };

  IframePlayerAdapter.prototype.enableInteraction = function enableInteraction() {
    this.iframe.style.pointerEvents = 'auto';
    this.iframe.setAttribute('tabindex', '0');
    try {
      this.iframe.focus();
      this.iframe.contentWindow.focus();
    } catch (error) {}
  };

  IframePlayerAdapter.prototype.disableInteraction = function disableInteraction() {
    this.iframe.style.pointerEvents = 'none';
    this.iframe.setAttribute('tabindex', '-1');
  };

  IframePlayerAdapter.prototype.restoreApplicationFocus = function restoreApplicationFocus() {
    var self = this;
    var focusTarget = this.iframe.parentNode;

    function focusPlayerScreen() {
      try {
        if (typeof self.iframe.blur === 'function') {
          self.iframe.blur();
        }
        if (self.iframe.contentWindow && typeof self.iframe.contentWindow.blur === 'function') {
          self.iframe.contentWindow.blur();
        }
        if (focusTarget && typeof focusTarget.focus === 'function') {
          focusTarget.focus();
        }
        window.focus();
      } catch (error) {}
    }

    if (this.focusRestoreTimeout) {
      window.clearTimeout(this.focusRestoreTimeout);
    }
    focusPlayerScreen();
    this.focusRestoreTimeout = window.setTimeout(function restoreAfterProviderEvent() {
      self.focusRestoreTimeout = null;
      focusPlayerScreen();
    }, 100);
  };

  IframePlayerAdapter.prototype.scheduleApplicationFocusGuards = function scheduleApplicationFocusGuards() {
    var self = this;
    var delays = [0, 250, 1000, 2500];
    var index;

    this.clearFocusGuards();
    for (index = 0; index < delays.length; index += 1) {
      this.focusGuardTimeouts.push(window.setTimeout(function recoverFocusDuringLoad() {
        if (!self.interactionActive && self.state !== 'released' && self.state !== 'error') {
          self.disableInteraction();
          self.restoreApplicationFocus();
        }
      }, delays[index]));
    }
  };

  IframePlayerAdapter.prototype.clearFocusGuards = function clearFocusGuards() {
    var index;

    for (index = 0; index < this.focusGuardTimeouts.length; index += 1) {
      window.clearTimeout(this.focusGuardTimeouts[index]);
    }
    this.focusGuardTimeouts = [];
  };

  IframePlayerAdapter.prototype.bindInteractionGuards = function bindInteractionGuards() {
    var self = this;

    this.boundWindowBlur = function onWindowBlur() {
      self.finishInteractionWindow('focus-lost', true);
    };
    this.boundVisibilityChange = function onVisibilityChange() {
      if (document.hidden) {
        self.finishInteractionWindow('focus-lost', true);
      }
    };
    window.addEventListener('blur', this.boundWindowBlur);
    document.addEventListener('visibilitychange', this.boundVisibilityChange);
  };

  IframePlayerAdapter.prototype.unbindInteractionGuards = function unbindInteractionGuards() {
    if (this.boundWindowBlur) {
      window.removeEventListener('blur', this.boundWindowBlur);
      this.boundWindowBlur = null;
    }
    if (this.boundVisibilityChange) {
      document.removeEventListener('visibilitychange', this.boundVisibilityChange);
      this.boundVisibilityChange = null;
    }
  };

  IframePlayerAdapter.prototype.getName = function getName() {
    return 'Iframe Embed';
  };

  IframePlayerAdapter.prototype.getState = function getState() {
    return this.state;
  };

  IframePlayerAdapter.prototype.clearStartTimeouts = function clearStartTimeouts() {
    var index;

    if (this.startTimeout) {
      window.clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    if (this.manualTimeout) {
      window.clearTimeout(this.manualTimeout);
      this.manualTimeout = null;
    }
    for (index = 0; index < this.actionTimeouts.length; index += 1) {
      window.clearTimeout(this.actionTimeouts[index]);
    }
    this.actionTimeouts = [];
  };

  IframePlayerAdapter.prototype.clearAllTimeouts = function clearAllTimeouts() {
    this.clearStartTimeouts();
    this.clearFocusGuards();
    if (this.interactionTimeout) {
      window.clearTimeout(this.interactionTimeout);
      this.interactionTimeout = null;
    }
    if (this.focusRestoreTimeout) {
      window.clearTimeout(this.focusRestoreTimeout);
      this.focusRestoreTimeout = null;
    }
  };

  function getStartup(profile) {
    return profile && profile.startup ? profile.startup : {};
  }

  function getVerification(profile) {
    return getStartup(profile).verification || { type: 'none' };
  }

  function getControls(profile) {
    return profile && profile.controls ? profile.controls : null;
  }

  function getTargetOrigin(profile) {
    var controls = getControls(profile);
    var verification = getVerification(profile);
    return controls && controls.targetOrigin ? controls.targetOrigin : verification.origin;
  }

  function parseMessageData(data) {
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch (error) { return null; }
    }
    return data && typeof data === 'object' ? data : null;
  }

  function contains(values, value) {
    var index;
    for (index = 0; index < values.length; index += 1) {
      if (values[index] === value) {
        return true;
      }
    }
    return false;
  }

  function buildUrl(url, params) {
    var result = normalizeProtocol(url);
    var hash = '';
    var hashIndex = result.indexOf('#');
    var key;

    params = params || {};

    if (hashIndex >= 0) {
      hash = result.slice(hashIndex);
      result = result.slice(0, hashIndex);
    }

    for (key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        result = setQueryParam(result, key, params[key]);
      }
    }
    return result + hash;
  }

  function setQueryParam(url, key, value) {
    var encodedKey = encodeURIComponent(key);
    var encodedValue = encodeURIComponent(value);
    var expression = new RegExp('([?&])' + escapeRegExp(encodedKey) + '=[^&#]*');

    if (expression.test(url)) {
      return url.replace(expression, '$1' + encodedKey + '=' + encodedValue);
    }
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + encodedKey + '=' + encodedValue;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeProtocol(url) {
    return url.indexOf('//') === 0 ? 'https:' + url : url;
  }

  function invoke(callback, payload) {
    if (typeof callback === 'function') {
      callback(payload);
    }
  }

  namespace.adapters.IframePlayerAdapter = IframePlayerAdapter;
}(window.TblackTV));

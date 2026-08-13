(function defineAppController(namespace) {
  'use strict';

  var KEY = {
    ENTER: 13,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    BACK: 10009,
    MEDIA_PLAY: 415,
    MEDIA_PAUSE: 19,
    MEDIA_PLAY_PAUSE: 10252,
    MEDIA_STOP: 413,
    CHANNEL_UP: 427,
    CHANNEL_DOWN: 428
  };

  function AppController(options) {
    this.state = options.state;
    this.eventBus = options.eventBus;
    this.navigation = options.navigation;
    this.gridView = options.gridView;
    this.playerView = options.playerView;
    this.playbackService = options.playbackService;
    this.playerKeyCapture = options.playerKeyCapture;
    this.boundKeyHandler = this.onKeyDown.bind(this);
    this.boundHardwareBackHandler = this.onHardwareBack.bind(this);
    this.boundFocusGuard = this.onApplicationFocus.bind(this);
    this.lastHandledEvent = null;
    this.lastBackActionAt = 0;
    this.lastSourceSwitchAt = 0;
    this.isCapturingPlayerFocus = false;
  }

  AppController.prototype.start = function start() {
    this.gridView.render(this.state.channels);
    this.gridView.focus(this.state.focusedChannelIndex);
    this.bindPlaybackEvents();
    window.addEventListener('keydown', this.boundKeyHandler, true);
    document.addEventListener('keydown', this.boundKeyHandler, true);
    if (this.playerKeyCapture) {
      this.playerKeyCapture.addEventListener('keydown', this.boundKeyHandler, true);
    }
    window.addEventListener('tizenhwkey', this.boundHardwareBackHandler, true);
    document.addEventListener('tizenhwkey', this.boundHardwareBackHandler, true);
    document.addEventListener('backbutton', this.boundHardwareBackHandler, true);
    document.addEventListener('focusin', this.boundFocusGuard, true);
    registerRemoteKeys();
  };

  AppController.prototype.bindPlaybackEvents = function bindPlaybackEvents() {
    var self = this;

    this.eventBus.on('playback:loading', function onLoading(payload) {
      self.state.hasError = false;
      self.state.requiresUserAction = false;
      self.state.iframeInteractionActive = false;
      self.state.selectSource(payload.sourceIndex);
      self.playerView.show(payload.channel, payload.source, payload.sourceIndex, payload.sourceCount, payload.canToggle, payload.canReopenInteraction);
      self.playerView.showLoading(payload.statusText);
      self.capturePlayerFocus();
    });

    this.eventBus.on('playback:resolving', function onResolving(payload) {
      self.state.hasError = false;
      self.state.requiresUserAction = false;
      self.state.iframeInteractionActive = false;
      self.state.selectSource(payload.sourceIndex);
      self.playerView.show(payload.channel, payload.source, payload.sourceIndex, payload.sourceCount, false);
      self.playerView.showLoading(payload.statusText);
      self.capturePlayerFocus();
    });

    this.eventBus.on('playback:ready', function onReady(payload) {
      self.state.requiresUserAction = false;
      self.state.iframeInteractionActive = false;
      self.playerView.hideActivation();
      self.playerView.hideLoading();
      self.playerView.hideInteractionMode();
      if (payload.canReopenInteraction) {
        self.playerView.setRetryInteractionAvailable();
      }
      self.capturePlayerFocus();
    });

    this.eventBus.on('playback:buffering', function onBuffering(isBuffering) {
      if (isBuffering) {
        self.playerView.showLoading('Carregando transmissão…');
      } else {
        self.playerView.hideLoading();
      }
    });

    this.eventBus.on('playback:bufferingProgress', function onBufferingProgress(percent) {
      self.playerView.updateBufferingProgress(percent);
    });

    this.eventBus.on('playback:state', function onState(isPlaying) {
      self.state.isPlaying = isPlaying;
      self.playerView.setPlayingState(isPlaying);
    });

    this.eventBus.on('playback:error', function onError(message) {
      self.state.hasError = true;
      self.state.requiresUserAction = false;
      self.state.iframeInteractionActive = false;
      self.playerView.showError(message);
      self.capturePlayerFocus();
    });

    this.eventBus.on('playback:userActionRequired', function onUserActionRequired(payload) {
      self.state.hasError = false;
      self.state.requiresUserAction = true;
      self.playerView.showActivation(payload.message);
      self.capturePlayerFocus();
    });

    this.eventBus.on('playback:activationStarted', function onActivationStarted(payload) {
      self.state.requiresUserAction = false;
      self.playerView.hideActivation();
      if (!payload.interactive) {
        self.playerView.showLoading(payload.message);
      }
    });

    this.eventBus.on('playback:manualInteraction', function onManualInteraction(message) {
      self.state.requiresUserAction = false;
      self.playerView.hideActivation();
      self.playerView.hideLoading();
      self.playerView.showNotice(message);
    });

    this.eventBus.on('playback:interactionStarted', function onInteractionStarted(payload) {
      self.state.requiresUserAction = false;
      self.state.iframeInteractionActive = true;
      self.playerView.showInteractionMode(payload.durationMs);
    });

    this.eventBus.on('playback:interactionEnded', function onInteractionEnded(payload) {
      self.state.iframeInteractionActive = false;
      self.playerView.hideInteractionMode();
      if (payload.reason === 'timeout' || payload.reason === 'focus-lost') {
        self.playerView.setRetryInteractionAvailable();
      }
      self.capturePlayerFocus();
    });

    this.eventBus.on('playback:notice', function onNotice(message) {
      self.playerView.showNotice(message);
    });
  };

  AppController.prototype.onKeyDown = function onKeyDown(event) {
    var keyCode;

    if (this.lastHandledEvent === event) {
      return;
    }
    this.lastHandledEvent = event;
    keyCode = normalizeKeyCode(event);

    if (isApplicationKey(keyCode)) {
      event.preventDefault();
      if (typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    }

    if (keyCode === KEY.BACK && !this.acceptBackAction()) {
      return;
    }

    if (this.state.screen === 'home') {
      this.handleHomeKey(keyCode);
      return;
    }

    this.handlePlayerKey(keyCode);
  };

  AppController.prototype.onHardwareBack = function onHardwareBack(event) {
    var keyName = event && (event.keyName || (event.detail && event.detail.keyName));

    if (event && event.type === 'tizenhwkey' && keyName !== 'back') {
      return;
    }
    if (this.lastHandledEvent === event) {
      return;
    }
    this.lastHandledEvent = event;
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (!this.acceptBackAction()) {
      return;
    }
    if (this.state.screen === 'home') {
      this.exitApplication();
    } else {
      this.handlePlayerKey(KEY.BACK);
    }
  };

  AppController.prototype.acceptBackAction = function acceptBackAction() {
    var now = Date.now ? Date.now() : new Date().getTime();

    /* Some Tizen/TizenBrew combinations deliver one physical Return press as
       both keydown and tizenhwkey/backbutton. Treat that burst as one action,
       otherwise the first event returns Home and the second exits the app. */
    if (now - this.lastBackActionAt < 1200) {
      return false;
    }
    this.lastBackActionAt = now;
    return true;
  };

  AppController.prototype.onApplicationFocus = function onApplicationFocus(event) {
    if (this.state.screen !== 'player' || this.state.iframeInteractionActive || this.isCapturingPlayerFocus) {
      return;
    }
    if (event.target !== this.playerKeyCapture) {
      this.capturePlayerFocus();
    }
  };

  AppController.prototype.capturePlayerFocus = function capturePlayerFocus() {
    var self = this;

    if (!this.playerKeyCapture || this.state.screen !== 'player' || this.state.iframeInteractionActive) {
      return;
    }
    function focusCapture() {
      if (self.state.screen === 'player' && !self.state.iframeInteractionActive && !self.isCapturingPlayerFocus) {
        self.isCapturingPlayerFocus = true;
        try {
          window.focus();
          self.playerKeyCapture.focus();
        } catch (error) {
        } finally {
          self.isCapturingPlayerFocus = false;
        }
      }
    }
    focusCapture();
    window.setTimeout(focusCapture, 80);
  };

  AppController.prototype.handleHomeKey = function handleHomeKey(keyCode) {
    if (keyCode === KEY.LEFT) {
      this.moveFocus('left');
    } else if (keyCode === KEY.RIGHT) {
      this.moveFocus('right');
    } else if (keyCode === KEY.UP) {
      this.moveFocus('up');
    } else if (keyCode === KEY.DOWN) {
      this.moveFocus('down');
    } else if (keyCode === KEY.ENTER) {
      this.openFocusedChannel();
    } else if (keyCode === KEY.BACK) {
      this.exitApplication();
    }
  };

  AppController.prototype.handlePlayerKey = function handlePlayerKey(keyCode) {
    // Navigation belongs to TblackTV in every player state. Handle it before
    // loading, activation and error-specific actions so a source can never
    // trap the user inside its iframe.
    if (keyCode === KEY.BACK || keyCode === KEY.MEDIA_STOP) {
      if (this.state.iframeInteractionActive) {
        this.playbackService.endInteractionWindow('navigation');
      }
      this.closePlayer();
      return;
    }
    if (keyCode === KEY.CHANNEL_UP || keyCode === KEY.CHANNEL_DOWN) {
      if (this.state.iframeInteractionActive) {
        this.playbackService.endInteractionWindow('navigation');
      }
      this.switchChannel(keyCode === KEY.CHANNEL_UP ? 1 : -1);
      return;
    }
    if (keyCode === KEY.LEFT || keyCode === KEY.RIGHT) {
      if (this.state.iframeInteractionActive) {
        this.playbackService.endInteractionWindow('navigation');
      }
      this.switchSource(keyCode === KEY.RIGHT ? 1 : -1);
      return;
    }

    if (this.state.iframeInteractionActive) {
      return;
    }

    if (this.state.requiresUserAction) {
      if (keyCode === KEY.ENTER) {
        this.playbackService.activateCurrentSource();
      }
      return;
    }

    if (this.state.hasError) {
      if (keyCode === KEY.ENTER) {
        this.state.hasError = false;
        this.playerView.hideError();
        this.playbackService.retry();
      }
      return;
    }

    if (keyCode === KEY.ENTER || keyCode === KEY.MEDIA_PLAY_PAUSE || keyCode === KEY.MEDIA_PLAY || keyCode === KEY.MEDIA_PAUSE) {
      this.playbackService.toggle();
    } else {
      this.playerView.showOverlay();
    }
  };

  AppController.prototype.moveFocus = function moveFocus(direction) {
    var nextIndex = this.navigation.move(direction);
    this.state.focusChannel(nextIndex);
    this.gridView.focus(nextIndex);
  };

  AppController.prototype.openFocusedChannel = function openFocusedChannel() {
    this.state.selectFocusedChannel();
    this.playCurrentChannel();
  };

  AppController.prototype.playCurrentChannel = function playCurrentChannel() {
    var channel = this.state.getCurrentChannel();
    if (channel) {
      this.playbackService.playChannel(channel, this.state.currentSourceIndex);
    }
  };

  AppController.prototype.switchChannel = function switchChannel(delta) {
    this.playbackService.stop();
    this.state.moveCurrentChannel(delta);
    this.playCurrentChannel();
  };

  AppController.prototype.switchSource = function switchSource(delta) {
    var now = Date.now ? Date.now() : new Date().getTime();

    if (now - this.lastSourceSwitchAt < 350) {
      return;
    }
    this.lastSourceSwitchAt = now;
    this.playbackService.moveSource(delta);
  };

  AppController.prototype.closePlayer = function closePlayer() {
    this.playbackService.stop();
    this.state.screen = 'home';
    this.state.hasError = false;
    this.state.requiresUserAction = false;
    this.state.iframeInteractionActive = false;
    this.state.isPlaying = false;
    this.navigation.setIndex(this.state.focusedChannelIndex);
    this.gridView.focus(this.state.focusedChannelIndex);
    this.playerView.hide();
  };

  AppController.prototype.exitApplication = function exitApplication() {
    try {
      if (window.tizen && window.tizen.application) {
        window.tizen.application.getCurrentApplication().exit();
        return;
      }
    } catch (error) {
      console.log('[App] Tizen exit unavailable:', error.message || error);
    }

    window.history.back();
  };

  function isApplicationKey(keyCode) {
    var keyName;

    for (keyName in KEY) {
      if (Object.prototype.hasOwnProperty.call(KEY, keyName) && KEY[keyName] === keyCode) {
        return true;
      }
    }
    return false;
  }

  function normalizeKeyCode(event) {
    var key = event.key;
    var keyCode = event.keyCode || event.which || 0;

    if (isApplicationKey(keyCode)) {
      return keyCode;
    }
    if (key === 'Enter') { return KEY.ENTER; }
    if (key === 'ArrowLeft') { return KEY.LEFT; }
    if (key === 'ArrowUp') { return KEY.UP; }
    if (key === 'ArrowRight') { return KEY.RIGHT; }
    if (key === 'ArrowDown') { return KEY.DOWN; }
    if (key === 'Backspace' || key === 'Escape') { return KEY.BACK; }
    return keyCode;
  }

  function registerRemoteKeys() {
    var keys = ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'ChannelUp', 'ChannelDown'];
    var inputDevice;
    var index;

    try {
      inputDevice = window.tizen && (window.tizen.tvinputdevice || window.tizen.inputdevice);
      if (!inputDevice) {
        return;
      }
      if (typeof inputDevice.registerKeyBatch === 'function') {
        inputDevice.registerKeyBatch(keys);
        return;
      }
      for (index = 0; index < keys.length; index += 1) {
        inputDevice.registerKey(keys[index]);
      }
    } catch (error) {
      console.log('[Remote] Optional key registration unavailable:', error.message || error);
    }
  }

  namespace.controllers.AppController = AppController;
}(window.TblackTV));

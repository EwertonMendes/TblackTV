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
    CHANNEL_DOWN: 428,
    FAVORITE: 70
  };

  function AppController(options) {
    this.state = options.state;
    this.eventBus = options.eventBus;
    this.navigation = options.navigation;
    this.gridView = options.gridView;
    this.playerView = options.playerView;
    this.playbackService = options.playbackService;
    this.playerKeyCapture = options.playerKeyCapture;
    this.sidebarView = options.sidebarView;
    this.favoritesService = options.favoritesService;
    this.searchInput = options.searchInput;
    this.menuItems = options.menuItems;
    this.boundKeyHandler = this.onKeyDown.bind(this);
    this.boundHardwareBackHandler = this.onHardwareBack.bind(this);
    this.boundFocusGuard = this.onApplicationFocus.bind(this);
    this.lastHandledEvent = null;
    this.lastBackActionAt = 0;
    this.lastSourceSwitchAt = 0;
    this.isCapturingPlayerFocus = false;
    this.homeFocusArea = 'grid';
    this.sidebarItems = ['channels', 'search', 'favorites'];
    this.sidebarItemIndex = 0;
    this.searchEditing = false;
  }

  AppController.prototype.start = function start() {
    this.state.setFavorites(this.favoritesService.asLookup());
    this.refreshHome();
    this.bindPlaybackEvents();
    this.bindSidebar();
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

  AppController.prototype.bindSidebar = function bindSidebar() {
    var self = this;
    var itemName;

    this.searchInput.addEventListener('input', function onSearchInput() {
      self.state.setFavoritesOnly(false);
      self.state.setSearchQuery(self.searchInput.value);
      self.refreshHome();
    });
    for (itemName in this.menuItems) {
      if (this.menuItems.hasOwnProperty(itemName)) {
        bindMenuClick(this.menuItems[itemName], itemName);
      }
    }

    function bindMenuClick(element, name) {
      element.addEventListener('click', function onMenuClick() {
        self.openSidebar(name);
        self.activateSidebarItem(name);
      });
    }
  };

  AppController.prototype.updateCatalog = function updateCatalog(channels) {
    this.state.setCatalog(channels);
    this.refreshHome();
  };

  AppController.prototype.refreshHome = function refreshHome() {
    this.navigation.setItemCount(this.state.channels.length);
    this.navigation.setIndex(this.state.focusedChannelIndex);
    this.gridView.render(this.state.channels, this.state.favoriteIds, this.state.focusedChannelIndex);
    this.sidebarView.updateState(this.state.searchQuery, this.state.favoritesOnly);
    if (this.homeFocusArea === 'sidebar') {
      this.sidebarView.setFocusedItem(this.sidebarItems[this.sidebarItemIndex]);
    } else {
      this.sidebarView.clearFocus();
      this.gridView.focus(this.state.focusedChannelIndex);
    }
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

    if (this.state.screen === 'home' && this.searchEditing) {
      this.handleSearchEditingKey(keyCode, event);
      return;
    }

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
    if (this.state.screen === 'home' && this.searchEditing) {
      this.handleSearchEditingKey(KEY.BACK, event || { preventDefault: function preventDefault() {} });
      return;
    }
    if (!this.acceptBackAction()) {
      return;
    }
    if (this.state.screen === 'home') {
      this.handleHomeKey(KEY.BACK);
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
    if (this.homeFocusArea === 'sidebar') {
      this.handleSidebarKey(keyCode);
      return;
    }

    if (keyCode === KEY.LEFT) {
      if (this.gridView.isFirstColumn(this.state.focusedChannelIndex)) {
        this.openSidebar(this.getActiveSidebarItem());
      } else {
        this.moveFocus('left');
      }
    } else if (keyCode === KEY.RIGHT) {
      this.moveFocus('right');
    } else if (keyCode === KEY.UP) {
      this.moveFocus('up');
    } else if (keyCode === KEY.DOWN) {
      this.moveFocus('down');
    } else if (keyCode === KEY.ENTER) {
      this.openFocusedChannel();
    } else if (keyCode === KEY.MEDIA_PLAY_PAUSE || keyCode === KEY.MEDIA_PLAY || keyCode === KEY.FAVORITE) {
      this.toggleFocusedFavorite();
    } else if (keyCode === KEY.CHANNEL_UP || keyCode === KEY.CHANNEL_DOWN) {
      this.movePage(keyCode === KEY.CHANNEL_UP ? -1 : 1);
    } else if (keyCode === KEY.BACK) {
      this.exitApplication();
    }
  };

  AppController.prototype.movePage = function movePage(direction) {
    var pageSize = this.gridView.getPageSize();
    var nextIndex = this.state.focusedChannelIndex + (direction * pageSize);

    nextIndex = Math.max(0, Math.min(this.state.channels.length - 1, nextIndex));
    this.navigation.setIndex(nextIndex);
    this.state.focusChannel(nextIndex);
    this.gridView.focus(nextIndex);
  };

  AppController.prototype.handleSidebarKey = function handleSidebarKey(keyCode) {
    if (keyCode === KEY.UP || keyCode === KEY.DOWN) {
      this.sidebarItemIndex += keyCode === KEY.DOWN ? 1 : -1;
      this.sidebarItemIndex = Math.max(0, Math.min(this.sidebarItems.length - 1, this.sidebarItemIndex));
      this.sidebarView.setFocusedItem(this.sidebarItems[this.sidebarItemIndex]);
    } else if (keyCode === KEY.RIGHT || keyCode === KEY.BACK) {
      this.closeSidebar();
    } else if (keyCode === KEY.ENTER) {
      this.activateSidebarItem(this.sidebarItems[this.sidebarItemIndex]);
    } else if (keyCode === KEY.MEDIA_PLAY_PAUSE || keyCode === KEY.MEDIA_PLAY || keyCode === KEY.FAVORITE) {
      this.toggleFocusedFavorite();
    } else if (keyCode === KEY.CHANNEL_UP || keyCode === KEY.CHANNEL_DOWN) {
      this.closeSidebar();
      this.movePage(keyCode === KEY.CHANNEL_UP ? -1 : 1);
    }
  };

  AppController.prototype.activateSidebarItem = function activateSidebarItem(itemName) {
    if (itemName === 'search') {
      this.state.setFavoritesOnly(false);
      this.refreshHome();
      this.startSearchEditing();
    } else if (itemName === 'favorites') {
      this.searchInput.value = '';
      this.state.setSearchQuery('');
      this.state.setFavoritesOnly(true);
      this.refreshHome();
      this.closeSidebar();
    } else if (itemName === 'channels') {
      this.searchInput.value = '';
      this.state.setSearchQuery('');
      this.state.setFavoritesOnly(false);
      this.refreshHome();
      this.closeSidebar();
    }
  };

  AppController.prototype.getActiveSidebarItem = function getActiveSidebarItem() {
    if (this.state.favoritesOnly) {
      return 'favorites';
    }
    if (this.state.searchQuery) {
      return 'search';
    }
    return 'channels';
  };

  AppController.prototype.openSidebar = function openSidebar(itemName) {
    var index = this.sidebarItems.indexOf(itemName);
    this.homeFocusArea = 'sidebar';
    this.sidebarItemIndex = index >= 0 ? index : 0;
    this.gridView.focus(-1);
    this.sidebarView.setExpanded(true);
    this.sidebarView.setFocusedItem(this.sidebarItems[this.sidebarItemIndex]);
  };

  AppController.prototype.closeSidebar = function closeSidebar() {
    this.searchEditing = false;
    this.sidebarView.stopSearchEditing();
    this.sidebarView.setExpanded(false);
    this.sidebarView.clearFocus();
    this.homeFocusArea = 'grid';
    this.gridView.focus(this.state.focusedChannelIndex);
  };

  AppController.prototype.handleSearchEditingKey = function handleSearchEditingKey(keyCode, event) {
    if (keyCode === KEY.ENTER) {
      event.preventDefault();
      this.stopSearchEditing(true);
    } else if (keyCode === KEY.BACK) {
      event.preventDefault();
      if (this.searchInput.value) {
        this.searchInput.value = '';
        this.state.setSearchQuery('');
        this.refreshHome();
      } else {
        this.stopSearchEditing(false);
      }
    }
  };

  AppController.prototype.startSearchEditing = function startSearchEditing() {
    this.searchEditing = true;
    this.sidebarView.startSearchEditing();
  };

  AppController.prototype.stopSearchEditing = function stopSearchEditing(returnToGrid) {
    this.searchEditing = false;
    this.sidebarView.stopSearchEditing();
    if (returnToGrid) {
      this.closeSidebar();
    } else {
      this.sidebarView.setFocusedItem('search');
    }
  };

  AppController.prototype.toggleFocusedFavorite = function toggleFocusedFavorite() {
    var channel = this.state.getFocusedChannel();
    if (!channel) {
      return;
    }
    this.favoritesService.toggle(channel.id);
    this.state.setFavorites(this.favoritesService.asLookup());
    this.refreshHome();
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
    if (!this.state.getFocusedChannel()) {
      return;
    }
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
    this.homeFocusArea = 'grid';
    this.refreshHome();
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

(function startTblackTV(namespace) {
  'use strict';

  function init() {
    var elements = collectElements();
    var clockView = new namespace.ui.ClockView(elements.clock);
    var catalog = namespace.config.embeddedCatalog;
    var controller;
    var refreshing = false;

    clockView.start();
    clearLegacyCatalogs();
    controller = buildApplication(elements, [], {});
    controller.onRefreshCatalog = refreshCatalog;
    refreshCatalog();

    function refreshCatalog() {
      if (refreshing) { return; }
      refreshing = true;
      elements.menuRefresh.setAttribute('aria-disabled', 'true');
      elements.refreshLabel.textContent = 'Atualizando…';
      setAppStatus(elements, 'Atualizando canais…', false);
      loadRemotePlaylists(elements, controller, [], catalog.remotePlaylists, function onComplete() {
        refreshing = false;
        elements.menuRefresh.setAttribute('aria-disabled', 'false');
        elements.refreshLabel.textContent = 'Atualizar canais';
      });
    }
  }

  function clearLegacyCatalogs() {
    try {
      var storage = window.localStorage;
      var index;
      var key;
      for (index = storage.length - 1; index >= 0; index -= 1) {
        key = storage.key(index);
        if (key === 'tblacktv.catalog.v1' || key.indexOf('tblacktv.remote-playlist.') === 0) {
          storage.removeItem(key);
        }
      }
    } catch (error) {}
  }

  function buildApplication(elements, channels, playerProfiles) {
    var eventBus = new namespace.core.EventBus();
    var state = new namespace.core.AppState(channels);
    var navigation = new namespace.core.SpatialNavigation(channels.length, 4);
    var gridView = new namespace.ui.ChannelGridView(elements.channelGrid, elements.channelCount);
    var sidebarView = new namespace.ui.SidebarView(elements);
    var favoritesService = new namespace.services.FavoritesService();
    var playerView = new namespace.ui.PlayerView(elements);
    var playerFactory = new namespace.services.PlayerFactory(elements, playerProfiles);
    var sourceResolver = new namespace.services.SourceResolver();
    var playbackService = new namespace.services.PlaybackService(playerFactory, sourceResolver, eventBus);
    var controller = new namespace.controllers.AppController({
      state: state,
      eventBus: eventBus,
      navigation: navigation,
      gridView: gridView,
      playerView: playerView,
      playerKeyCapture: elements.playerKeyCapture,
      playbackService: playbackService,
      sidebarView: sidebarView,
      favoritesService: favoritesService,
      searchInput: elements.searchInput,
      homeFocusTarget: elements.homeScreen,
      menuItems: {
        channels: elements.menuChannels,
        search: elements.menuSearch,
        favorites: elements.menuFavorites,
        refresh: elements.menuRefresh
      }
    });

    controller.start();
    return controller;
  }

  function loadRemotePlaylists(elements, controller, localChannels, playlists, onComplete) {
    var service = new namespace.services.RemotePlaylistCatalogService();

    service.load(playlists, localChannels, {
      onProgress: function onProgress(completed, total) {
        setAppStatus(elements, 'Atualizando listas ' + completed + '/' + total, false);
      },
      onSuccess: function onSuccess(channels, result) {
        controller.updateCatalog(channels);
        if (result.warnings.length) {
          setAppStatus(elements, 'Falha ao carregar. Menu ←: Atualizar canais', true);
        } else {
          setAppStatus(elements, 'Online • ' + channels.length + ' canais', false);
        }
        onComplete();
      }
    });
  }

  function setAppStatus(elements, text, isWarning) {
    elements.appStatus.textContent = text;
    if (isWarning) {
      elements.appStatus.parentNode.classList.add('status-pill--warning');
    } else {
      elements.appStatus.parentNode.classList.remove('status-pill--warning');
    }
  }

  function collectElements() {
    return {
      homeScreen: document.getElementById('home-screen'),
      playerScreen: document.getElementById('player-screen'),
      playerKeyCapture: document.getElementById('player-key-capture'),
      channelGrid: document.getElementById('channel-grid'),
      channelCount: document.getElementById('channel-count'),
      clock: document.getElementById('clock'),
      appStatus: document.getElementById('app-status'),
      sideMenu: document.getElementById('side-menu'),
      sideMenuScrim: document.getElementById('side-menu-scrim'),
      sideSearchPanel: document.getElementById('side-search-panel'),
      searchActiveDot: document.getElementById('search-active-dot'),
      searchInput: document.getElementById('channel-search'),
      menuChannels: document.getElementById('menu-channels'),
      menuSearch: document.getElementById('menu-search'),
      menuFavorites: document.getElementById('menu-favorites'),
      menuRefresh: document.getElementById('menu-refresh'),
      refreshLabel: document.getElementById('refresh-label'),
      filterSummary: document.getElementById('filter-summary'),
      avPlayer: document.getElementById('av-player'),
      html5Player: document.getElementById('html5-player'),
      iframePlayer: document.getElementById('iframe-player'),
      loading: document.getElementById('player-loading'),
      loadingText: document.getElementById('player-loading-text'),
      overlay: document.getElementById('player-overlay'),
      channelName: document.getElementById('player-channel-name'),
      sourceName: document.getElementById('player-source-name'),
      playStateIcon: document.getElementById('play-state-icon'),
      playStateLabel: document.getElementById('play-state-label'),
      errorDialog: document.getElementById('error-dialog'),
      errorMessage: document.getElementById('error-message'),
      activationDialog: document.getElementById('activation-dialog'),
      activationMessage: document.getElementById('activation-message'),
      interactionBanner: document.getElementById('interaction-banner'),
      interactionBannerText: document.getElementById('interaction-banner-text')
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}(window.TblackTV));

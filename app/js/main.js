(function startTblackTV(namespace) {
  'use strict';

  function init() {
    var elements = collectElements();
    var clockView = new namespace.ui.ClockView(elements.clock);
    var fallbackDocuments = {
      catalog: namespace.config.embeddedCatalog,
      profiles: namespace.config.embeddedProfiles
    };

    clockView.start();
    setAppStatus(elements, 'Preparando canais', false);

    window.setTimeout(function loadBundledCatalog() {
      new namespace.services.CatalogService(
      'config/channels.json',
      'config/player-profiles.json',
      null,
      fallbackDocuments
      ).loadEmbedded(
      function onCatalogReady(catalog) {
        var controller = buildApplication(elements, catalog.channels, catalog.profiles);
        setAppStatus(elements, 'Atualizando catálogo', false);
        loadRemotePlaylists(elements, controller, catalog.channels, fallbackDocuments.catalog.remotePlaylists || []);
      },
      function onCatalogError(message) {
        setAppStatus(elements, 'Catálogo indisponível', true);
        showStartupError(elements, message);
      }
      );
    }, 80);
  }

  function buildApplication(elements, channels, playerProfiles) {
    var eventBus = new namespace.core.EventBus();
    var state = new namespace.core.AppState(channels);
    var navigation = new namespace.core.SpatialNavigation(channels.length, 4);
    var gridView = new namespace.ui.ChannelGridView(elements.channelGrid, elements.channelCount);
    var catalogControlsView = new namespace.ui.CatalogControlsView(elements);
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
      catalogControlsView: catalogControlsView,
      favoritesService: favoritesService,
      searchInput: elements.searchInput,
      searchControl: elements.searchControl,
      favoritesControl: elements.favoritesControl
    });

    controller.start();
    return controller;
  }

  function loadRemotePlaylists(elements, controller, localChannels, playlists) {
    var service = new namespace.services.RemotePlaylistCatalogService();

    service.load(playlists, localChannels, {
      onProgress: function onProgress(completed, total) {
        setAppStatus(elements, 'Atualizando listas ' + completed + '/' + total, false);
      },
      onSuccess: function onSuccess(channels, result) {
        controller.updateCatalog(channels);
        if (result.warnings.length) {
          setAppStatus(elements, result.remoteCount ? 'Catálogo em cache' : 'Catálogo local', true);
        } else {
          setAppStatus(elements, 'Online • ' + channels.length + ' canais', false);
        }
      }
    });
  }

  function showStartupError(elements, message) {
    elements.channelCount.textContent = 'Catálogo indisponível';
    elements.channelGrid.textContent = message;
    elements.channelGrid.classList.add('channel-grid--error');
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
      searchInput: document.getElementById('channel-search'),
      searchControl: document.getElementById('search-control'),
      favoritesControl: document.getElementById('favorites-control'),
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

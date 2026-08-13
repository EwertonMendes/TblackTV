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
    setAppStatus(elements, 'Carregando canais', false);

    new namespace.services.CatalogService(
      'config/channels.json',
      'config/player-profiles.json',
      null,
      fallbackDocuments
    ).load(
      function onCatalogReady(catalog) {
        buildApplication(elements, catalog.channels, catalog.profiles);
        if (catalog.origin === 'network') {
          setAppStatus(elements, 'Online', false);
        } else {
          setAppStatus(elements, 'Catálogo local', true);
          console.log('[Catalog] Fallback ativo:', catalog.warning);
        }
      },
      function onCatalogError(message) {
        setAppStatus(elements, 'Catálogo indisponível', true);
        showStartupError(elements, message);
      }
    );
  }

  function buildApplication(elements, channels, playerProfiles) {
    var eventBus = new namespace.core.EventBus();
    var state = new namespace.core.AppState(channels);
    var navigation = new namespace.core.SpatialNavigation(channels.length, 4);
    var gridView = new namespace.ui.ChannelGridView(elements.channelGrid, elements.channelCount);
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
      playbackService: playbackService
    });

    controller.start();
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
      channelGrid: document.getElementById('channel-grid'),
      channelCount: document.getElementById('channel-count'),
      clock: document.getElementById('clock'),
      appStatus: document.getElementById('app-status'),
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

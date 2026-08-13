(function startApplication(namespace) {
  'use strict';

  function init() {
    var elements = collectElements();
    var eventBus = new namespace.core.EventBus();
    var state = new namespace.core.AppState(namespace.config.channels);
    var navigation = new namespace.core.SpatialNavigation(namespace.config.channels.length, 4);
    var gridView = new namespace.ui.ChannelGridView(elements.channelGrid, elements.channelCount);
    var playerView = new namespace.ui.PlayerView(elements);
    var playerFactory = new namespace.services.PlayerFactory(elements);
    var playbackService = new namespace.services.PlaybackService(playerFactory.create(), eventBus);
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

  function collectElements() {
    return {
      homeScreen: document.getElementById('home-screen'),
      playerScreen: document.getElementById('player-screen'),
      channelGrid: document.getElementById('channel-grid'),
      channelCount: document.getElementById('channel-count'),
      avPlayer: document.getElementById('av-player'),
      html5Player: document.getElementById('html5-player'),
      loading: document.getElementById('player-loading'),
      loadingText: document.getElementById('player-loading-text'),
      overlay: document.getElementById('player-overlay'),
      channelName: document.getElementById('player-channel-name'),
      sourceName: document.getElementById('player-source-name'),
      playStateIcon: document.getElementById('play-state-icon'),
      playStateLabel: document.getElementById('play-state-label'),
      errorDialog: document.getElementById('error-dialog'),
      errorMessage: document.getElementById('error-message')
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}(window.SportsHub));

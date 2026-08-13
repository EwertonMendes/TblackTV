(function definePlaybackService(namespace) {
  'use strict';

  function PlaybackService(player, eventBus) {
    this.player = player;
    this.eventBus = eventBus;
    this.channel = null;
    this.sourceIndex = 0;
  }

  PlaybackService.prototype.playChannel = function playChannel(channel, preferredSourceIndex) {
    this.channel = channel;
    this.sourceIndex = preferredSourceIndex || 0;
    this.tryCurrentSource();
  };

  PlaybackService.prototype.tryCurrentSource = function tryCurrentSource() {
    var self = this;
    var source = this.getCurrentSource();

    if (!source) {
      this.eventBus.emit('playback:error', 'Nenhuma fonte de reprodução está configurada para este canal.');
      return;
    }

    this.eventBus.emit('playback:loading', {
      channel: this.channel,
      source: source,
      playerName: this.player.getName()
    });

    this.player.load(source.url, {
      onReady: function onReady() {
        self.eventBus.emit('playback:ready', { channel: self.channel, source: source });
      },
      onBuffering: function onBuffering(isBuffering) {
        self.eventBus.emit('playback:buffering', isBuffering);
      },
      onBufferingProgress: function onBufferingProgress(percent) {
        self.eventBus.emit('playback:bufferingProgress', percent);
      },
      onPlayStateChange: function onPlayStateChange(isPlaying) {
        self.eventBus.emit('playback:state', isPlaying);
      },
      onError: function onError(message) {
        self.handleSourceError(message);
      }
    });
  };

  PlaybackService.prototype.handleSourceError = function handleSourceError(message) {
    var sources = this.channel ? this.channel.sources : [];

    if (this.sourceIndex + 1 < sources.length) {
      this.sourceIndex += 1;
      this.tryCurrentSource();
      return;
    }

    this.eventBus.emit('playback:error', message || 'Todas as fontes deste canal falharam.');
  };

  PlaybackService.prototype.retry = function retry() {
    this.sourceIndex = 0;
    this.tryCurrentSource();
  };

  PlaybackService.prototype.toggle = function toggle() {
    return this.player.toggle();
  };

  PlaybackService.prototype.stop = function stop() {
    this.player.release();
  };

  PlaybackService.prototype.getCurrentSource = function getCurrentSource() {
    var sources = this.channel ? this.channel.sources : [];
    return sources[this.sourceIndex] || null;
  };

  namespace.services.PlaybackService = PlaybackService;
}(window.SportsHub));

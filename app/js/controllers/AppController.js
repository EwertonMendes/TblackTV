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
    this.boundKeyHandler = this.onKeyDown.bind(this);
  }

  AppController.prototype.start = function start() {
    this.gridView.render(this.state.channels);
    this.gridView.focus(this.state.focusedChannelIndex);
    this.bindPlaybackEvents();
    this.startClock();
    document.addEventListener('keydown', this.boundKeyHandler);
  };

  AppController.prototype.bindPlaybackEvents = function bindPlaybackEvents() {
    var self = this;

    this.eventBus.on('playback:loading', function onLoading(payload) {
      self.state.hasError = false;
      self.playerView.show(payload.channel, payload.source);
    });

    this.eventBus.on('playback:ready', function onReady() {
      self.playerView.hideLoading();
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
      self.playerView.showError(message);
    });
  };

  AppController.prototype.onKeyDown = function onKeyDown(event) {
    if (this.state.screen === 'home') {
      this.handleHomeKey(event.keyCode);
      return;
    }

    this.handlePlayerKey(event.keyCode);
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
    if (this.state.hasError) {
      if (keyCode === KEY.ENTER) {
        this.state.hasError = false;
        this.playerView.hideError();
        this.playbackService.retry();
      } else if (keyCode === KEY.BACK) {
        this.closePlayer();
      }
      return;
    }

    if (keyCode === KEY.BACK || keyCode === KEY.MEDIA_STOP) {
      this.closePlayer();
    } else if (keyCode === KEY.ENTER || keyCode === KEY.MEDIA_PLAY_PAUSE || keyCode === KEY.MEDIA_PLAY || keyCode === KEY.MEDIA_PAUSE) {
      this.playbackService.toggle();
    } else if (keyCode === KEY.CHANNEL_UP) {
      this.switchChannel(1);
    } else if (keyCode === KEY.CHANNEL_DOWN) {
      this.switchChannel(-1);
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

  AppController.prototype.closePlayer = function closePlayer() {
    this.playbackService.stop();
    this.state.screen = 'home';
    this.state.hasError = false;
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

  AppController.prototype.startClock = function startClock() {
    var clock = document.getElementById('clock');

    function updateClock() {
      var date = new Date();
      var hours = pad(date.getHours());
      var minutes = pad(date.getMinutes());
      clock.textContent = hours + ':' + minutes;
    }

    function pad(value) {
      return value < 10 ? '0' + value : String(value);
    }

    updateClock();
    window.setInterval(updateClock, 30000);
  };

  namespace.controllers.AppController = AppController;
}(window.SportsHub));

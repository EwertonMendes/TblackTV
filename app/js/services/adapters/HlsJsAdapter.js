(function defineHlsJsAdapter(namespace) {
  'use strict';

  function HlsJsAdapter(videoElement) {
    this.video = videoElement;
    this.hls = null;
    this.callbacks = null;
    this.boundHandlers = null;
    this.readyEmitted = false;
    this.autoplayBlockedEmitted = false;
  }

  HlsJsAdapter.isSupported = function isSupported() {
    return !!(window.Hls && typeof window.Hls.isSupported === 'function' && window.Hls.isSupported());
  };

  HlsJsAdapter.prototype.load = function load(source, callbacks) {
    var self = this;

    this.release();
    this.callbacks = callbacks || {};
    this.video.style.display = 'block';
    this.bindVideoEvents();

    try {
      this.hls = new window.Hls({
        enableWorker: false,
        lowLatencyMode: false,
        backBufferLength: 30
      });
      this.hls.on(window.Hls.Events.MEDIA_ATTACHED, function onMediaAttached() {
        if (self.hls) {
          self.hls.loadSource(source.url);
        }
      });
      this.hls.on(window.Hls.Events.ERROR, function onHlsError(eventName, data) {
        if (data && data.fatal) {
          invoke(self.callbacks, 'onError', describeHlsError(data));
        }
      });
      this.hls.attachMedia(this.video);
    } catch (error) {
      invoke(this.callbacks, 'onError', error.message || 'O modo de compatibilidade HLS falhou ao iniciar.');
    }
  };

  HlsJsAdapter.prototype.bindVideoEvents = function bindVideoEvents() {
    var self = this;

    this.boundHandlers = {
      waiting: function onWaiting() { invoke(self.callbacks, 'onBuffering', true); },
      playing: function onPlaying() {
        if (!self.readyEmitted) {
          self.readyEmitted = true;
          invoke(self.callbacks, 'onReady');
        }
        invoke(self.callbacks, 'onBuffering', false);
        invoke(self.callbacks, 'onPlayStateChange', true);
      },
      pause: function onPause() { invoke(self.callbacks, 'onPlayStateChange', false); },
      canplay: function onCanPlay() { self.requestPlay(false); },
      error: function onVideoError() {
        invoke(self.callbacks, 'onError', 'O modo de compatibilidade HLS nao conseguiu decodificar esta transmissao.');
      }
    };

    Object.keys(this.boundHandlers).forEach(function addHandler(eventName) {
      self.video.addEventListener(eventName, self.boundHandlers[eventName]);
    });
  };

  HlsJsAdapter.prototype.requestPlay = function requestPlay(fromUserGesture) {
    var self = this;
    var promise;

    try {
      promise = this.video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(function onPlayRejected() {
          if (fromUserGesture) {
            invoke(self.callbacks, 'onError', 'A TV recusou a reproducao mesmo apos a confirmacao.');
          } else if (!self.autoplayBlockedEmitted) {
            self.autoplayBlockedEmitted = true;
            invoke(self.callbacks, 'onAutoplayBlocked', 'A TV bloqueou o inicio automatico do video.');
          }
        });
      }
    } catch (error) {
      if (fromUserGesture) {
        invoke(this.callbacks, 'onError', 'Nao foi possivel iniciar o video.');
      } else if (!this.autoplayBlockedEmitted) {
        this.autoplayBlockedEmitted = true;
        invoke(this.callbacks, 'onAutoplayBlocked', 'A TV bloqueou o inicio automatico do video.');
      }
    }
  };

  HlsJsAdapter.prototype.activateFromUserGesture = function activateFromUserGesture() {
    this.requestPlay(true);
    return true;
  };

  HlsJsAdapter.prototype.canActivateFromUserGesture = function canActivateFromUserGesture() {
    return true;
  };

  HlsJsAdapter.prototype.toggle = function toggle() {
    if (this.video.paused) {
      this.requestPlay(true);
      return true;
    }
    this.video.pause();
    return false;
  };

  HlsJsAdapter.prototype.stop = function stop() {
    try { this.video.pause(); } catch (error) {}
  };

  HlsJsAdapter.prototype.release = function release() {
    var self = this;

    this.stop();
    if (this.boundHandlers) {
      Object.keys(this.boundHandlers).forEach(function removeHandler(eventName) {
        self.video.removeEventListener(eventName, self.boundHandlers[eventName]);
      });
      this.boundHandlers = null;
    }
    if (this.hls) {
      try { this.hls.destroy(); } catch (error) {}
      this.hls = null;
    }
    this.video.removeAttribute('src');
    this.video.style.display = 'none';
    this.callbacks = null;
    this.readyEmitted = false;
    this.autoplayBlockedEmitted = false;
    try { this.video.load(); } catch (error) {}
  };

  HlsJsAdapter.prototype.getName = function getName() {
    return 'HLS compativel (MSE)';
  };

  HlsJsAdapter.prototype.canToggle = function canToggle() {
    return true;
  };

  function describeHlsError(data) {
    var detail = data.details || data.type || '';
    return 'Falha no modo de compatibilidade HLS' + (detail ? ': ' + detail : '.');
  }

  function invoke(callbacks, name, payload) {
    if (callbacks && typeof callbacks[name] === 'function') {
      callbacks[name](payload);
    }
  }

  namespace.adapters.HlsJsAdapter = HlsJsAdapter;
}(window.TblackTV));

(function defineHtml5VideoAdapter(namespace) {
  'use strict';

  function Html5VideoAdapter(videoElement) {
    this.video = videoElement;
    this.callbacks = null;
    this.boundHandlers = null;
    this.readyEmitted = false;
    this.autoplayBlockedEmitted = false;
    this.autoplayCheckTimeout = null;
    this.manualPlayTimeout = null;
  }

  Html5VideoAdapter.prototype.load = function load(source, callbacks) {
    this.release();
    this.callbacks = callbacks || {};
    this.readyEmitted = false;
    this.autoplayBlockedEmitted = false;
    this.bindEvents();
    this.video.style.display = 'block';
    this.video.src = source.url;
    this.video.autoplay = true;
    this.video.load();
    this.requestPlay(false);
  };

  Html5VideoAdapter.prototype.requestPlay = function requestPlay(fromUserGesture) {
    var self = this;
    var promise;

    try {
      promise = this.video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(function onPlayRejected() {
          if (fromUserGesture) {
            self.clearPlayTimeouts();
            invoke(self.callbacks.onError, 'O navegador recusou a reprodução mesmo após a confirmação.');
          } else {
            self.notifyAutoplayBlocked();
          }
        });
      }
    } catch (error) {
      if (fromUserGesture) {
        this.clearPlayTimeouts();
        invoke(this.callbacks.onError, 'Não foi possível iniciar o vídeo.');
      } else {
        this.notifyAutoplayBlocked();
      }
    }
  };

  Html5VideoAdapter.prototype.activateFromUserGesture = function activateFromUserGesture() {
    var self = this;

    this.clearPlayTimeouts();
    this.requestPlay(true);
    this.manualPlayTimeout = window.setTimeout(function checkManualPlayback() {
      if (!self.readyEmitted && self.video.paused) {
        self.clearPlayTimeouts();
        invoke(self.callbacks.onError, 'O vídeo não iniciou após a confirmação pelo controle.');
      }
    }, 5000);
    return true;
  };

  Html5VideoAdapter.prototype.canActivateFromUserGesture = function canActivateFromUserGesture() {
    return true;
  };

  Html5VideoAdapter.prototype.toggle = function toggle() {
    if (this.video.paused) {
      this.requestPlay(true);
      return true;
    }

    this.video.pause();
    invoke(this.callbacks.onPlayStateChange, false);
    return false;
  };

  Html5VideoAdapter.prototype.stop = function stop() {
    try { this.video.pause(); } catch (error) {}
  };

  Html5VideoAdapter.prototype.release = function release() {
    this.clearPlayTimeouts();
    this.stop();
    this.unbindEvents();
    this.video.removeAttribute('src');
    this.video.style.display = 'none';
    this.callbacks = null;
    this.readyEmitted = false;
    this.autoplayBlockedEmitted = false;
    try { this.video.load(); } catch (error) {}
  };

  Html5VideoAdapter.prototype.getName = function getName() {
    return 'HTML5 Video';
  };

  Html5VideoAdapter.prototype.canToggle = function canToggle() {
    return true;
  };

  Html5VideoAdapter.prototype.bindEvents = function bindEvents() {
    var self = this;

    this.boundHandlers = {
      loadeddata: function onLoadedData() {
        invoke(self.callbacks.onBuffering, false);
        if (!self.readyEmitted && self.video.paused && !self.autoplayBlockedEmitted) {
          self.autoplayCheckTimeout = window.setTimeout(function verifyAutoplay() {
            if (!self.readyEmitted && self.video.paused) {
              self.notifyAutoplayBlocked();
            }
          }, 500);
        }
      },
      waiting: function onWaiting() { invoke(self.callbacks.onBuffering, true); },
      playing: function onPlaying() {
        self.clearPlayTimeouts();
        if (!self.readyEmitted) {
          self.readyEmitted = true;
          invoke(self.callbacks.onReady);
        }
        invoke(self.callbacks.onBuffering, false);
        invoke(self.callbacks.onPlayStateChange, true);
      },
      pause: function onPause() { invoke(self.callbacks.onPlayStateChange, false); },
      error: function onError() { invoke(self.callbacks.onError, 'O player HTML5 não conseguiu abrir esta transmissão.'); }
    };

    Object.keys(this.boundHandlers).forEach(function addHandler(eventName) {
      self.video.addEventListener(eventName, self.boundHandlers[eventName]);
    });
  };

  Html5VideoAdapter.prototype.unbindEvents = function unbindEvents() {
    var self = this;

    if (!this.boundHandlers) { return; }
    Object.keys(this.boundHandlers).forEach(function removeHandler(eventName) {
      self.video.removeEventListener(eventName, self.boundHandlers[eventName]);
    });
    this.boundHandlers = null;
  };

  Html5VideoAdapter.prototype.notifyAutoplayBlocked = function notifyAutoplayBlocked() {
    if (this.autoplayBlockedEmitted || this.readyEmitted) {
      return;
    }
    this.autoplayBlockedEmitted = true;
    this.clearPlayTimeouts();
    invoke(this.callbacks.onAutoplayBlocked, 'O navegador bloqueou o início automático do vídeo.');
  };

  Html5VideoAdapter.prototype.clearPlayTimeouts = function clearPlayTimeouts() {
    if (this.autoplayCheckTimeout) {
      window.clearTimeout(this.autoplayCheckTimeout);
      this.autoplayCheckTimeout = null;
    }
    if (this.manualPlayTimeout) {
      window.clearTimeout(this.manualPlayTimeout);
      this.manualPlayTimeout = null;
    }
  };

  function invoke(callback, payload) {
    if (typeof callback === 'function') {
      callback(payload);
    }
  }

  namespace.adapters.Html5VideoAdapter = Html5VideoAdapter;
}(window.TblackTV));

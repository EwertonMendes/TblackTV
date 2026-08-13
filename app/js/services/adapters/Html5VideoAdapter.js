(function defineHtml5VideoAdapter(namespace) {
  'use strict';

  function Html5VideoAdapter(videoElement) {
    this.video = videoElement;
    this.callbacks = null;
    this.boundHandlers = null;
  }

  Html5VideoAdapter.prototype.load = function load(url, callbacks) {
    this.release();
    this.callbacks = callbacks || {};
    this.bindEvents();
    this.video.style.display = 'block';
    this.video.src = url;
    this.video.autoplay = true;
    this.video.load();

    var promise = this.video.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function ignoreAutoplayPromise() {});
    }
  };

  Html5VideoAdapter.prototype.toggle = function toggle() {
    if (this.video.paused) {
      this.video.play();
      invoke(this.callbacks.onPlayStateChange, true);
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
    this.stop();
    this.unbindEvents();
    this.video.removeAttribute('src');
    this.video.style.display = 'none';
    try { this.video.load(); } catch (error) {}
  };

  Html5VideoAdapter.prototype.getName = function getName() {
    return 'HTML5 Video';
  };

  Html5VideoAdapter.prototype.bindEvents = function bindEvents() {
    var self = this;

    this.boundHandlers = {
      loadeddata: function onLoadedData() {
        invoke(self.callbacks.onReady);
        invoke(self.callbacks.onBuffering, false);
        invoke(self.callbacks.onPlayStateChange, true);
      },
      waiting: function onWaiting() { invoke(self.callbacks.onBuffering, true); },
      playing: function onPlaying() { invoke(self.callbacks.onBuffering, false); },
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

  function invoke(callback, payload) {
    if (typeof callback === 'function') {
      callback(payload);
    }
  }

  namespace.adapters.Html5VideoAdapter = Html5VideoAdapter;
}(window.TblackTV));

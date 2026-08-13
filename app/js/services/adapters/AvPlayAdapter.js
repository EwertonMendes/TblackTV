(function defineAvPlayAdapter(namespace) {
  'use strict';

  function AvPlayAdapter(objectElement) {
    this.objectElement = objectElement;
    this.callbacks = null;
    this.prepared = false;
  }

  AvPlayAdapter.isSupported = function isSupported() {
    return !!(window.webapis && window.webapis.avplay);
  };

  AvPlayAdapter.prototype.load = function load(source, callbacks) {
    var self = this;
    var url = source.url;
    var displayRect;

    this.callbacks = callbacks || {};
    this.prepared = false;
    this.release();

    try {
      window.webapis.avplay.open(url);
      displayRect = getDisplayRect(this.objectElement);
      window.webapis.avplay.setDisplayRect(displayRect.x, displayRect.y, displayRect.width, displayRect.height);
      window.webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');

      try {
        window.webapis.avplay.setStreamingProperty('ADAPTIVE_INFO', 'STARTBITRATE=HIGHEST');
      } catch (streamingError) {
        console.log('[AVPlay] Adaptive hint unavailable:', streamingError.message || streamingError);
      }

      window.webapis.avplay.setListener(createListener(this));
      window.webapis.avplay.prepareAsync(
        function onPrepared() {
          self.prepared = true;
          window.webapis.avplay.play();
          invoke(self.callbacks.onReady);
          invoke(self.callbacks.onPlayStateChange, true);
        },
        function onPrepareError(error) {
          invoke(self.callbacks.onError, normalizeError(error, 'Falha ao preparar a transmissão.'));
        }
      );
    } catch (error) {
      invoke(this.callbacks.onError, normalizeError(error, 'Falha ao iniciar o AVPlay.'));
    }
  };

  AvPlayAdapter.prototype.toggle = function toggle() {
    var state;

    try {
      state = window.webapis.avplay.getState();
      if (state === 'PLAYING') {
        window.webapis.avplay.pause();
        invoke(this.callbacks.onPlayStateChange, false);
        return false;
      }
      if (state === 'PAUSED' || state === 'READY') {
        window.webapis.avplay.play();
        invoke(this.callbacks.onPlayStateChange, true);
        return true;
      }
    } catch (error) {
      invoke(this.callbacks.onError, normalizeError(error, 'Não foi possível alterar o estado do player.'));
    }

    return false;
  };

  AvPlayAdapter.prototype.stop = function stop() {
    var state;

    try {
      state = window.webapis.avplay.getState();
      if (state === 'PLAYING' || state === 'PAUSED' || state === 'READY') {
        window.webapis.avplay.stop();
      }
    } catch (error) {
      console.log('[AVPlay] stop ignored:', error.message || error);
    }
  };

  AvPlayAdapter.prototype.release = function release() {
    try {
      this.stop();
      if (window.webapis && window.webapis.avplay && window.webapis.avplay.getState() !== 'NONE') {
        window.webapis.avplay.close();
      }
    } catch (error) {
      console.log('[AVPlay] release ignored:', error.message || error);
    }
    this.prepared = false;
  };

  AvPlayAdapter.prototype.getName = function getName() {
    return 'Samsung AVPlay';
  };

  AvPlayAdapter.prototype.canToggle = function canToggle() {
    return true;
  };

  AvPlayAdapter.prototype.canActivateFromUserGesture = function canActivateFromUserGesture() {
    return false;
  };

  AvPlayAdapter.prototype.activateFromUserGesture = function activateFromUserGesture() {
    return false;
  };

  function createListener(adapter) {
    return {
      onbufferingstart: function onBufferingStart() {
        invoke(adapter.callbacks.onBuffering, true);
      },
      onbufferingprogress: function onBufferingProgress(percent) {
        invoke(adapter.callbacks.onBufferingProgress, percent);
      },
      onbufferingcomplete: function onBufferingComplete() {
        invoke(adapter.callbacks.onBuffering, false);
      },
      onstreamcompleted: function onStreamCompleted() {
        invoke(adapter.callbacks.onError, 'A transmissão foi encerrada.');
      },
      oncurrentplaytime: function onCurrentPlaytime() {},
      onerror: function onError(eventType) {
        invoke(adapter.callbacks.onError, 'Erro AVPlay: ' + eventType);
      },
      onevent: function onEvent() {},
      onsubtitlechange: function onSubtitleChange() {},
      ondrmevent: function onDrmEvent() {}
    };
  }

  function getDisplayRect(element) {
    var rect;
    var width;
    var height;

    try {
      rect = element.getBoundingClientRect();
    } catch (error) {
      rect = null;
    }
    width = rect && rect.width ? rect.width : (window.innerWidth || 1920);
    height = rect && rect.height ? rect.height : (window.innerHeight || 1080);
    return {
      x: Math.max(0, Math.round(rect && rect.left ? rect.left : 0)),
      y: Math.max(0, Math.round(rect && rect.top ? rect.top : 0)),
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height))
    };
  }

  function normalizeError(error, fallback) {
    if (!error) { return fallback; }
    return error.message || String(error) || fallback;
  }

  function invoke(callback, payload) {
    if (typeof callback === 'function') {
      callback(payload);
    }
  }

  namespace.adapters.AvPlayAdapter = AvPlayAdapter;
}(window.TblackTV));

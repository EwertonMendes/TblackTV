(function defineIframePlayerAdapter(namespace) {
  'use strict';

  /*
   * Iframes are deliberately treated as ordinary embedded pages.
   * TblackTV does not inspect their DOM, send autoplay commands or try to
   * infer whether a cross-origin video is playing. A successful iframe load
   * only means that the embedded page was delivered.
   */
  function IframePlayerAdapter(iframeElement) {
    this.iframe = iframeElement;
    this.callbacks = {};
    this.state = 'idle';
    this.interactionActive = false;
    this.boundLoad = this.handleLoad.bind(this);
    this.boundError = this.handleError.bind(this);
  }

  IframePlayerAdapter.prototype.load = function load(source, callbacks) {
    this.release();
    this.callbacks = callbacks || {};
    this.state = 'loading';

    this.configureFrame(source || {});
    this.iframe.addEventListener('load', this.boundLoad);
    this.iframe.addEventListener('error', this.boundError);
    this.iframe.src = normalizeUrl(source && source.url);
  };

  IframePlayerAdapter.prototype.configureFrame = function configureFrame(source) {
    this.iframe.style.display = 'block';
    this.iframe.style.visibility = 'visible';
    this.disableInteraction();

    /* No sandbox is the closest equivalent to a normal iframe. Providers
       that explicitly need a sandbox can opt in per source in channels.json. */
    if (source.sandbox) {
      this.iframe.setAttribute('sandbox', sanitizeSandbox(source.sandbox));
    } else {
      this.iframe.removeAttribute('sandbox');
    }
    this.iframe.setAttribute('allow', 'encrypted-media; fullscreen; picture-in-picture');
    this.iframe.setAttribute('allowfullscreen', 'allowfullscreen');
  };

  IframePlayerAdapter.prototype.handleLoad = function handleLoad() {
    if (this.state !== 'loading') {
      return;
    }
    this.state = 'ready';
    call(this.callbacks.onBuffering, false);
    call(this.callbacks.onReady);
  };

  IframePlayerAdapter.prototype.handleError = function handleError() {
    if (this.state === 'released' || this.state === 'idle') {
      return;
    }
    this.state = 'error';
    call(this.callbacks.onError, 'A p\u00e1gina incorporada n\u00e3o p\u00f4de ser carregada.');
  };

  IframePlayerAdapter.prototype.activateFromUserGesture = function activateFromUserGesture() {
    return this.beginInteraction();
  };

  IframePlayerAdapter.prototype.canActivateFromUserGesture = function canActivateFromUserGesture() {
    return this.canReopenInteractionWindow();
  };

  IframePlayerAdapter.prototype.reopenInteractionWindow = function reopenInteractionWindow() {
    return this.beginInteraction();
  };

  IframePlayerAdapter.prototype.beginInteraction = function beginInteraction() {
    if (!this.canReopenInteractionWindow()) {
      return false;
    }

    this.interactionActive = true;
    this.state = 'interactive';
    this.iframe.style.pointerEvents = 'auto';
    this.iframe.setAttribute('tabindex', '0');
    try {
      this.iframe.focus();
      if (this.iframe.contentWindow && typeof this.iframe.contentWindow.focus === 'function') {
        this.iframe.contentWindow.focus();
      }
    } catch (error) {}

    call(this.callbacks.onInteractionStarted, {
      durationMs: 0,
      persistent: true
    });
    return true;
  };

  IframePlayerAdapter.prototype.cancelInteractionWindow = function cancelInteractionWindow(reason) {
    if (!this.interactionActive) {
      return false;
    }

    this.interactionActive = false;
    this.state = 'ready';
    this.disableInteraction();
    call(this.callbacks.onInteractionEnded, {
      reason: reason || 'navigation'
    });
    return true;
  };

  IframePlayerAdapter.prototype.canReopenInteractionWindow = function canReopenInteractionWindow() {
    return !this.interactionActive && (this.state === 'ready' || this.state === 'interactive');
  };

  IframePlayerAdapter.prototype.isInteractionWindowActive = function isInteractionWindowActive() {
    return this.interactionActive;
  };

  IframePlayerAdapter.prototype.usesTimedInteraction = function usesTimedInteraction() {
    return false;
  };

  IframePlayerAdapter.prototype.toggle = function toggle() {
    if (this.interactionActive) {
      try {
        this.iframe.focus();
        if (this.iframe.contentWindow && typeof this.iframe.contentWindow.focus === 'function') {
          this.iframe.contentWindow.focus();
        }
      } catch (error) {}
      return true;
    }
    return this.beginInteraction();
  };

  IframePlayerAdapter.prototype.canToggle = function canToggle() {
    return false;
  };

  IframePlayerAdapter.prototype.stop = function stop() {
    this.cancelInteractionWindow('navigation');
  };

  IframePlayerAdapter.prototype.release = function release() {
    this.interactionActive = false;
    this.iframe.removeEventListener('load', this.boundLoad);
    this.iframe.removeEventListener('error', this.boundError);
    this.disableInteraction();
    this.iframe.removeAttribute('src');
    this.iframe.style.display = 'none';
    this.iframe.style.visibility = 'hidden';
    this.callbacks = {};
    this.state = 'released';
  };

  IframePlayerAdapter.prototype.disableInteraction = function disableInteraction() {
    this.iframe.style.pointerEvents = 'none';
    this.iframe.setAttribute('tabindex', '-1');
  };

  IframePlayerAdapter.prototype.getName = function getName() {
    return 'iframe';
  };

  IframePlayerAdapter.prototype.getState = function getState() {
    return this.state;
  };

  function normalizeUrl(url) {
    if (!url) {
      throw new Error('A fonte iframe n\u00e3o possui URL.');
    }
    if (url.indexOf('//') === 0) {
      return 'https:' + url;
    }
    return url;
  }

  function sanitizeSandbox(value) {
    var supported = {
      'allow-same-origin': true,
      'allow-scripts': true,
      'allow-forms': true,
      'allow-top-navigation': true
    };
    return String(value).split(/\s+/).filter(function filterToken(token) {
      return supported[token];
    }).join(' ');
  }

  function call(callback, payload) {
    if (typeof callback === 'function') {
      callback(payload);
    }
  }

  namespace.adapters.IframePlayerAdapter = IframePlayerAdapter;
}(window.TblackTV));

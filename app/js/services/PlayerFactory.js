(function definePlayerFactory(namespace) {
  'use strict';

  function PlayerFactory(elements, playerProfiles) {
    this.elements = elements;
    this.playerProfiles = playerProfiles || {};
  }

  PlayerFactory.prototype.create = function create(source) {
    if (source.type === 'iframe') {
      return new namespace.adapters.IframePlayerAdapter(
        this.elements.iframePlayer,
        resolveIframeProfile(source, this.playerProfiles)
      );
    }

    if (!isDirectMediaSource(source.type)) {
      throw new Error('Tipo de fonte não reproduzível: ' + source.type + '.');
    }

    if (namespace.adapters.AvPlayAdapter.isSupported()) {
      return new namespace.adapters.AvPlayAdapter(this.elements.avPlayer);
    }
    return new namespace.adapters.Html5VideoAdapter(this.elements.html5Player);
  };

  function isDirectMediaSource(type) {
    return type === 'hls' || type === 'dash' || type === 'video';
  }

  function resolveIframeProfile(source, profiles) {
    if (source.playerProfile && profiles[source.playerProfile]) {
      return profiles[source.playerProfile];
    }

    if (source.controls) {
      return {
        id: 'legacy-inline-controls',
        kind: 'iframe',
        startup: {
          postMessages: [{ message: source.controls.play, delaysMs: [0, 500, 1500] }],
          verification: { type: 'none' },
          timeoutMs: source.timeoutMs || 6000,
          manualFallback: 'postMessage'
        },
        controls: source.controls
      };
    }

    return profiles['opaque-iframe'] || {
      id: 'opaque-iframe',
      kind: 'iframe',
      startup: {
        securityMode: 'interaction-shield',
        verification: { type: 'none' },
        timeoutMs: source.timeoutMs || 5000,
        manualFallback: 'timedInteraction',
        interactionWindowMs: 6000,
        manualCompletion: 'assume-playing'
      }
    };
  }

  namespace.services.PlayerFactory = PlayerFactory;
}(window.TblackTV));

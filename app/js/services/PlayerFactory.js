(function definePlayerFactory(namespace) {
  'use strict';

  function PlayerFactory(elements, playerProfiles) {
    this.elements = elements;
    this.playerProfiles = playerProfiles || {};
  }

  PlayerFactory.prototype.create = function create(source) {
    if (source.type === 'iframe') {
      return new namespace.adapters.IframePlayerAdapter(this.elements.iframePlayer);
    }

    if (!isDirectMediaSource(source.type)) {
      throw new Error('Tipo de fonte não reproduzível: ' + source.type + '.');
    }

    if (requiresHlsCompatibility(source) && namespace.adapters.HlsJsAdapter.isSupported()) {
      return new namespace.adapters.HlsJsAdapter(this.elements.html5Player);
    }

    if (namespace.adapters.AvPlayAdapter.isSupported()) {
      return new namespace.adapters.AvPlayAdapter(this.elements.avPlayer);
    }
    return new namespace.adapters.Html5VideoAdapter(this.elements.html5Player);
  };

  function isDirectMediaSource(type) {
    return type === 'hls' || type === 'dash' || type === 'video';
  }

  function requiresHlsCompatibility(source) {
    return source.type === 'hls' && (source.hlsPlayback === 'mse' ||
      /\/(?:file|index|__index)\.txt(?:[?#]|$)/i.test(String(source.url || '')));
  }

  namespace.services.PlayerFactory = PlayerFactory;
}(window.TblackTV));

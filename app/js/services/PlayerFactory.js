(function definePlayerFactory(namespace) {
  'use strict';

  function PlayerFactory(elements) {
    this.elements = elements;
  }

  PlayerFactory.prototype.create = function create() {
    if (namespace.adapters.AvPlayAdapter.isSupported()) {
      return new namespace.adapters.AvPlayAdapter(this.elements.avPlayer);
    }
    return new namespace.adapters.Html5VideoAdapter(this.elements.html5Player);
  };

  namespace.services.PlayerFactory = PlayerFactory;
}(window.SportsHub));

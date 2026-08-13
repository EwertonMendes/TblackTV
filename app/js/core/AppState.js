(function defineAppState(namespace) {
  'use strict';

  function AppState(channels) {
    this.allChannels = channels || [];
    this.channels = channels || [];
    this.favoriteIds = {};
    this.searchQuery = '';
    this.favoritesOnly = false;
    this.focusedChannelIndex = 0;
    this.currentChannelIndex = null;
    this.currentSourceIndex = 0;
    this.screen = 'home';
    this.isPlaying = false;
    this.hasError = false;
    this.requiresUserAction = false;
    this.iframeInteractionActive = false;
  }

  AppState.prototype.setCatalog = function setCatalog(channels) {
    var focused = this.getFocusedChannel();
    var current = this.getCurrentChannel();

    this.allChannels = channels || [];
    this.applyFilters(focused && focused.id, current && current.id);
  };

  AppState.prototype.setFavorites = function setFavorites(favoriteIds) {
    var focused = this.getFocusedChannel();
    var current = this.getCurrentChannel();
    this.favoriteIds = favoriteIds || {};
    this.applyFilters(focused && focused.id, current && current.id);
  };

  AppState.prototype.setSearchQuery = function setSearchQuery(query) {
    var focused = this.getFocusedChannel();
    this.searchQuery = query || '';
    this.applyFilters(focused && focused.id, null);
  };

  AppState.prototype.setFavoritesOnly = function setFavoritesOnly(isEnabled) {
    var focused = this.getFocusedChannel();
    this.favoritesOnly = !!isEnabled;
    this.applyFilters(focused && focused.id, null);
  };

  AppState.prototype.applyFilters = function applyFilters(focusedId, currentId) {
    var self = this;
    var query = normalizeText(this.searchQuery);

    this.channels = this.allChannels.filter(function includeChannel(channel) {
      if (self.favoritesOnly && !self.favoriteIds[channel.id]) {
        return false;
      }
      return !query || normalizeText(channel.name + ' ' + channel.category).indexOf(query) >= 0;
    }).sort(function favoritesFirst(left, right) {
      var leftFavorite = !!self.favoriteIds[left.id];
      var rightFavorite = !!self.favoriteIds[right.id];
      if (leftFavorite !== rightFavorite) {
        return leftFavorite ? -1 : 1;
      }
      return normalizeText(left.name).localeCompare(normalizeText(right.name));
    });

    this.focusedChannelIndex = findChannelIndex(this.channels, focusedId);
    if (this.focusedChannelIndex < 0) {
      this.focusedChannelIndex = 0;
    }
    if (currentId) {
      this.currentChannelIndex = findChannelIndex(this.channels, currentId);
      if (this.currentChannelIndex < 0) {
        this.currentChannelIndex = null;
      }
    }
  };

  AppState.prototype.getFocusedChannel = function getFocusedChannel() {
    return this.channels[this.focusedChannelIndex] || null;
  };

  AppState.prototype.getCurrentChannel = function getCurrentChannel() {
    if (this.currentChannelIndex === null) {
      return null;
    }
    return this.channels[this.currentChannelIndex] || null;
  };

  AppState.prototype.selectFocusedChannel = function selectFocusedChannel() {
    this.currentChannelIndex = this.focusedChannelIndex;
    this.currentSourceIndex = 0;
    this.screen = 'player';
    this.hasError = false;
    this.requiresUserAction = false;
    this.iframeInteractionActive = false;
  };

  AppState.prototype.focusChannel = function focusChannel(index) {
    if (index >= 0 && index < this.channels.length) {
      this.focusedChannelIndex = index;
    }
  };

  AppState.prototype.moveCurrentChannel = function moveCurrentChannel(delta) {
    var length = this.channels.length;

    if (!length || this.currentChannelIndex === null) {
      return;
    }

    this.currentChannelIndex = (this.currentChannelIndex + delta + length) % length;
    this.focusedChannelIndex = this.currentChannelIndex;
    this.currentSourceIndex = 0;
    this.hasError = false;
    this.requiresUserAction = false;
    this.iframeInteractionActive = false;
  };

  AppState.prototype.selectSource = function selectSource(index) {
    var channel = this.getCurrentChannel();
    var sourceCount = channel && channel.sources ? channel.sources.length : 0;

    if (index >= 0 && index < sourceCount) {
      this.currentSourceIndex = index;
    }
  };

  function findChannelIndex(channels, id) {
    var index;
    if (!id) {
      return -1;
    }
    for (index = 0; index < channels.length; index += 1) {
      if (channels[index].id === id) {
        return index;
      }
    }
    return -1;
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase()
      .replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i').replace(/[óòôõö]/g, 'o')
      .replace(/[úùûü]/g, 'u').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  namespace.core.AppState = AppState;
}(window.TblackTV));

(function defineFavoritesService(namespace) {
  'use strict';

  var STORAGE_KEY = 'tblacktv.favorites.v1';

  function FavoritesService() {
    this.favoriteIds = readFavoriteIds();
  }

  FavoritesService.prototype.has = function has(channelId) {
    return this.favoriteIds.indexOf(channelId) >= 0;
  };

  FavoritesService.prototype.toggle = function toggle(channelId) {
    var index = this.favoriteIds.indexOf(channelId);
    if (index >= 0) {
      this.favoriteIds.splice(index, 1);
    } else {
      this.favoriteIds.push(channelId);
    }
    this.save();
    return this.has(channelId);
  };

  FavoritesService.prototype.asLookup = function asLookup() {
    var result = {};
    this.favoriteIds.forEach(function addId(id) { result[id] = true; });
    return result;
  };

  FavoritesService.prototype.save = function save() {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favoriteIds));
      }
    } catch (error) {}
  };

  function readFavoriteIds() {
    var value;
    try {
      value = window.localStorage ? JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') : [];
      return Array.isArray(value) ? value.filter(function onlyStrings(id) { return typeof id === 'string'; }) : [];
    } catch (error) {
      return [];
    }
  }

  namespace.services.FavoritesService = FavoritesService;
}(window.TblackTV));

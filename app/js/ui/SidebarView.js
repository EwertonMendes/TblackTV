(function defineSidebarView(namespace) {
  'use strict';

  function SidebarView(elements) {
    this.menuElement = elements.sideMenu;
    this.scrimElement = elements.sideMenuScrim;
    this.searchPanel = elements.sideSearchPanel;
    this.searchInput = elements.searchInput;
    this.filterSummary = elements.filterSummary;
    this.searchActiveDot = elements.searchActiveDot;
    this.items = {
      channels: elements.menuChannels,
      search: elements.menuSearch,
      favorites: elements.menuFavorites
    };
  }

  SidebarView.prototype.setExpanded = function setExpanded(isExpanded) {
    this.menuElement.classList.toggle('is-expanded', !!isExpanded);
    this.scrimElement.classList.toggle('is-visible', !!isExpanded);
    this.menuElement.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  };

  SidebarView.prototype.setFocusedItem = function setFocusedItem(itemName) {
    var name;
    for (name in this.items) {
      if (this.items.hasOwnProperty(name)) {
        this.items[name].classList.toggle('is-focused', name === itemName);
      }
    }
  };

  SidebarView.prototype.clearFocus = function clearFocus() {
    this.setFocusedItem('');
  };

  SidebarView.prototype.startSearchEditing = function startSearchEditing() {
    var self = this;
    this.menuElement.classList.add('is-searching');
    this.searchPanel.classList.remove('is-hidden');
    this.searchInput.setAttribute('tabindex', '0');
    window.setTimeout(function focusSearchInput() {
      try { self.searchInput.focus(); } catch (error) {}
    }, 0);
  };

  SidebarView.prototype.stopSearchEditing = function stopSearchEditing() {
    /* Blur before hiding the input. Some TV browsers otherwise keep the
       hidden search control as document.activeElement. */
    try { this.searchInput.blur(); } catch (error) {}
    this.menuElement.classList.remove('is-searching');
    this.searchPanel.classList.add('is-hidden');
    this.searchInput.setAttribute('tabindex', '-1');
  };

  SidebarView.prototype.updateState = function updateState(query, favoritesOnly) {
    var hasQuery = !!query;
    this.items.channels.classList.toggle('is-active', !hasQuery && !favoritesOnly);
    this.items.search.classList.toggle('is-active', hasQuery && !favoritesOnly);
    this.items.favorites.classList.toggle('is-active', !!favoritesOnly);
    this.items.favorites.setAttribute('aria-pressed', favoritesOnly ? 'true' : 'false');
    this.searchActiveDot.classList.toggle('is-visible', hasQuery);

    if (favoritesOnly) {
      this.filterSummary.textContent = 'Meus favoritos';
    } else if (hasQuery) {
      this.filterSummary.textContent = 'Resultados para “' + query + '”';
    } else {
      this.filterSummary.textContent = 'Catálogo completo';
    }
  };

  namespace.ui.SidebarView = SidebarView;
}(window.TblackTV));

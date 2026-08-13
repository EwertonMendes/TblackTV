(function defineCatalogControlsView(namespace) {
  'use strict';

  function CatalogControlsView(elements) {
    this.searchInput = elements.searchInput;
    this.searchControl = elements.searchControl;
    this.favoritesControl = elements.favoritesControl;
    this.filterSummary = elements.filterSummary;
  }

  CatalogControlsView.prototype.setFocusedControl = function setFocusedControl(controlName) {
    this.searchControl.classList.toggle('is-focused', controlName === 'search');
    this.favoritesControl.classList.toggle('is-focused', controlName === 'favorites');
  };

  CatalogControlsView.prototype.clearFocus = function clearFocus() {
    this.searchControl.classList.remove('is-focused');
    this.favoritesControl.classList.remove('is-focused');
  };

  CatalogControlsView.prototype.startSearchEditing = function startSearchEditing() {
    this.searchControl.classList.add('is-editing');
    this.searchInput.setAttribute('tabindex', '0');
    try { this.searchInput.focus(); } catch (error) {}
  };

  CatalogControlsView.prototype.stopSearchEditing = function stopSearchEditing() {
    this.searchControl.classList.remove('is-editing');
    this.searchInput.setAttribute('tabindex', '-1');
    try { this.searchInput.blur(); } catch (error) {}
  };

  CatalogControlsView.prototype.setFavoritesOnly = function setFavoritesOnly(isEnabled) {
    this.favoritesControl.classList.toggle('is-active', !!isEnabled);
    this.favoritesControl.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
    this.favoritesControl.querySelector('.catalog-control__label').textContent = isEnabled ? 'Mostrando favoritos' : 'Todos os canais';
  };

  CatalogControlsView.prototype.updateSummary = function updateSummary(query, favoritesOnly) {
    var parts = [];
    if (query) { parts.push('Busca: “' + query + '”'); }
    if (favoritesOnly) { parts.push('Somente favoritos'); }
    this.filterSummary.textContent = parts.length ? parts.join(' • ') : 'Catálogo completo';
  };

  namespace.ui.CatalogControlsView = CatalogControlsView;
}(window.TblackTV));

(function definePlayerView(namespace) {
  'use strict';

  function PlayerView(elements) {
    this.elements = elements;
    this.overlayTimeout = null;
  }

  PlayerView.prototype.show = function show(channel, source) {
    this.elements.homeScreen.classList.add('is-hidden');
    this.elements.playerScreen.classList.remove('is-hidden');
    this.elements.channelName.textContent = channel.name;
    this.elements.sourceName.textContent = source ? source.label : '';
    this.hideError();
    this.showOverlay();
    this.showLoading('Conectando ao canal…');
  };

  PlayerView.prototype.hide = function hide() {
    this.clearOverlayTimer();
    this.elements.playerScreen.classList.add('is-hidden');
    this.elements.homeScreen.classList.remove('is-hidden');
    this.hideLoading();
    this.hideError();
  };

  PlayerView.prototype.showLoading = function showLoading(message) {
    this.elements.loadingText.textContent = message || 'Carregando…';
    this.elements.loading.classList.remove('is-hidden');
  };

  PlayerView.prototype.updateBufferingProgress = function updateBufferingProgress(percent) {
    this.elements.loadingText.textContent = 'Carregando transmissão… ' + percent + '%';
  };

  PlayerView.prototype.hideLoading = function hideLoading() {
    this.elements.loading.classList.add('is-hidden');
  };

  PlayerView.prototype.showError = function showError(message) {
    this.hideLoading();
    this.elements.errorMessage.textContent = message || 'A fonte não respondeu.';
    this.elements.errorDialog.classList.remove('is-hidden');
    this.showOverlay();
  };

  PlayerView.prototype.hideError = function hideError() {
    this.elements.errorDialog.classList.add('is-hidden');
  };

  PlayerView.prototype.setPlayingState = function setPlayingState(isPlaying) {
    this.elements.playStateIcon.textContent = isPlaying ? 'Ⅱ' : '▶';
    this.elements.playStateLabel.textContent = isPlaying ? 'OK para pausar' : 'OK para continuar';
    this.showOverlay();
  };

  PlayerView.prototype.showOverlay = function showOverlay() {
    var self = this;

    this.clearOverlayTimer();
    this.elements.overlay.classList.remove('is-dimmed');
    this.overlayTimeout = window.setTimeout(function dimOverlay() {
      self.elements.overlay.classList.add('is-dimmed');
    }, 4500);
  };

  PlayerView.prototype.clearOverlayTimer = function clearOverlayTimer() {
    if (this.overlayTimeout) {
      window.clearTimeout(this.overlayTimeout);
      this.overlayTimeout = null;
    }
  };

  namespace.ui.PlayerView = PlayerView;
}(window.TblackTV));

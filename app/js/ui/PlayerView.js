(function definePlayerView(namespace) {
  'use strict';

  function PlayerView(elements) {
    this.elements = elements;
    this.overlayTimeout = null;
  }

  PlayerView.prototype.show = function show(channel, source, sourceIndex, sourceCount, canToggle, canReopenInteraction) {
    this.elements.homeScreen.classList.add('is-hidden');
    this.elements.playerScreen.classList.remove('is-hidden');
    this.elements.channelName.textContent = channel.name;
    this.elements.sourceName.textContent = formatSourceName(source, sourceIndex, sourceCount);
    this.setControlAvailability(canToggle, canReopenInteraction);
    this.hideError();
    this.hideActivation();
    this.hideInteractionMode();
    this.showOverlay();
    this.showLoading('Conectando ao canal…');
    focusElement(this.elements.playerScreen);
  };

  PlayerView.prototype.hide = function hide() {
    this.clearOverlayTimer();
    this.elements.playerScreen.classList.add('is-hidden');
    this.elements.homeScreen.classList.remove('is-hidden');
    this.hideLoading();
    this.hideError();
    this.hideActivation();
    this.hideInteractionMode();
    focusElement(this.elements.homeScreen);
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
    this.hideActivation();
    this.hideInteractionMode();
    this.elements.errorMessage.textContent = message || 'A fonte não respondeu.';
    this.elements.errorDialog.classList.remove('is-hidden');
    this.showOverlay();
  };

  PlayerView.prototype.hideError = function hideError() {
    this.elements.errorDialog.classList.add('is-hidden');
  };

  PlayerView.prototype.showActivation = function showActivation(message) {
    this.hideLoading();
    this.hideError();
    this.hideInteractionMode();
    this.elements.activationMessage.textContent = message || 'OK para iniciar esta fonte';
    this.elements.activationDialog.classList.remove('is-hidden');
    this.showOverlay();
  };

  PlayerView.prototype.hideActivation = function hideActivation() {
    this.elements.activationDialog.classList.add('is-hidden');
  };

  PlayerView.prototype.setPlayingState = function setPlayingState(isPlaying) {
    this.elements.playStateIcon.textContent = isPlaying ? 'Ⅱ' : '▶';
    this.elements.playStateLabel.textContent = isPlaying ? 'OK para pausar' : 'OK para continuar';
    this.showOverlay();
  };

  PlayerView.prototype.setControlAvailability = function setControlAvailability(canToggle, canReopenInteraction) {
    if (canToggle) {
      this.elements.playStateIcon.textContent = 'Ⅱ';
      this.elements.playStateLabel.textContent = 'OK para pausar';
      return;
    }
    if (canReopenInteraction) {
      this.setRetryInteractionAvailable();
      return;
    }
    this.elements.playStateIcon.textContent = '•';
    this.elements.playStateLabel.textContent = 'Controle pelo provedor';
  };

  PlayerView.prototype.showInteractionMode = function showInteractionMode(durationMs) {
    var seconds = Math.round((durationMs || 6000) / 1000);

    this.hideLoading();
    this.hideActivation();
    this.hideError();
    this.clearOverlayTimer();
    this.elements.overlay.classList.remove('is-dimmed');
    this.elements.interactionBannerText.textContent = 'Acione o Play — controle do TblackTV retorna em ' + seconds + ' segundos';
    this.elements.interactionBanner.classList.remove('is-hidden');
  };

  PlayerView.prototype.hideInteractionMode = function hideInteractionMode() {
    this.elements.interactionBanner.classList.add('is-hidden');
  };

  PlayerView.prototype.setRetryInteractionAvailable = function setRetryInteractionAvailable() {
    this.elements.playStateIcon.textContent = '▶';
    this.elements.playStateLabel.textContent = 'OK para tentar o Play novamente';
    this.showOverlay();
  };

  PlayerView.prototype.showNotice = function showNotice(message) {
    this.elements.playStateLabel.textContent = message;
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

  function formatSourceName(source, sourceIndex, sourceCount) {
    var label = source ? source.label : '';

    if (sourceCount > 1) {
      label += '  •  Fonte ' + (sourceIndex + 1) + ' de ' + sourceCount;
    }
    return label;
  }

  function focusElement(element) {
    window.setTimeout(function focusAfterScreenChange() {
      try {
        window.focus();
        element.focus();
      } catch (error) {}
    }, 0);
  }

  namespace.ui.PlayerView = PlayerView;
}(window.TblackTV));

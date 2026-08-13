(function definePlaybackService(namespace) {
  'use strict';

  var DEFAULT_START_TIMEOUT_MS = 20000;

  function PlaybackService(playerFactory, sourceResolver, eventBus) {
    this.playerFactory = playerFactory;
    this.sourceResolver = sourceResolver;
    this.eventBus = eventBus;
    this.player = null;
    this.channel = null;
    this.sourceIndex = 0;
    this.sourcesTried = 0;
    this.resolvedSources = [];
    this.resolvedSourceIndex = 0;
    this.operationId = 0;
    this.cancelResolution = null;
    this.startTimeout = null;
    this.manualCandidate = null;
    this.restoringManualCandidate = false;
    this.awaitingUserAction = false;
    this.manualActivationInProgress = false;
    this.interactionActive = false;
    this.lastFailureMessage = '';
  }

  PlaybackService.prototype.playChannel = function playChannel(channel, preferredSourceIndex) {
    this.resetActivePlayback();
    this.channel = channel;
    this.sourceIndex = normalizeIndex(preferredSourceIndex || 0, this.getSources().length);
    this.sourcesTried = 0;
    this.manualCandidate = null;
    this.restoringManualCandidate = false;
    this.manualActivationInProgress = false;
    this.interactionActive = false;
    this.lastFailureMessage = '';
    this.tryConfiguredSource();
  };

  PlaybackService.prototype.tryConfiguredSource = function tryConfiguredSource() {
    var self = this;
    var configuredSource = this.getConfiguredSource();
    var operationId;

    this.cancelPendingResolution();
    this.releasePlayer();
    this.clearStartTimeout();
    this.awaitingUserAction = false;

    if (!configuredSource) {
      this.finishWithError('Nenhuma fonte de reprodução está configurada para este canal.');
      return;
    }

    operationId = this.nextOperationId();
    this.eventBus.emit('playback:resolving', this.createPlaybackPayload(configuredSource, this.getStartingMessage()));

    this.cancelResolution = this.sourceResolver.resolve(configuredSource, {
      onSuccess: function onResolved(resolvedSources) {
        if (!self.isCurrentOperation(operationId)) {
          return;
        }

        self.cancelResolution = null;
        self.resolvedSources = resolvedSources;
        self.resolvedSourceIndex = 0;
        self.tryResolvedSource();
      },
      onError: function onResolveError(message) {
        if (!self.isCurrentOperation(operationId)) {
          return;
        }

        self.cancelResolution = null;
        self.handleConfiguredSourceFailure(message);
      }
    });
  };

  PlaybackService.prototype.tryResolvedSource = function tryResolvedSource() {
    var self = this;
    var source = this.getResolvedSource();
    var operationId;

    this.releasePlayer();
    this.clearStartTimeout();
    this.awaitingUserAction = false;

    if (!source) {
      this.handleConfiguredSourceFailure('A fonte não produziu uma mídia reproduzível.');
      return;
    }

    try {
      this.player = this.playerFactory.create(source);
    } catch (error) {
      this.handleResolvedSourceFailure(error.message || String(error));
      return;
    }

    operationId = this.nextOperationId();
    this.eventBus.emit('playback:loading', this.createPlaybackPayload(source, this.getStartingMessage()));
    this.startTimeout = window.setTimeout(function onStartTimeout() {
      if (self.isCurrentOperation(operationId)) {
        self.handleResolvedSourceFailure('A fonte demorou demais para iniciar.');
      }
    }, source.timeoutMs || DEFAULT_START_TIMEOUT_MS);

    try {
      this.player.load(source, {
      onReady: function onReady() {
        if (!self.isCurrentOperation(operationId)) {
          return;
        }
        self.clearStartTimeout();
        self.awaitingUserAction = false;
        self.manualActivationInProgress = false;
        self.restoringManualCandidate = false;
        self.manualCandidate = null;
        self.eventBus.emit('playback:ready', {
          channel: self.channel,
          source: source,
          canReopenInteraction: self.playerCanReopenInteraction()
        });
      },
      onBuffering: function onBuffering(isBuffering) {
        if (self.isCurrentOperation(operationId)) {
          self.eventBus.emit('playback:buffering', isBuffering);
        }
      },
      onBufferingProgress: function onBufferingProgress(percent) {
        if (self.isCurrentOperation(operationId)) {
          self.eventBus.emit('playback:bufferingProgress', percent);
        }
      },
      onPlayStateChange: function onPlayStateChange(isPlaying) {
        if (self.isCurrentOperation(operationId)) {
          self.eventBus.emit('playback:state', isPlaying);
        }
      },
      onAutoplayBlocked: function onAutoplayBlocked(message) {
        if (self.isCurrentOperation(operationId)) {
          self.handleAutoplayBlocked(message);
        }
      },
      onManualInteraction: function onManualInteraction(message) {
        if (self.isCurrentOperation(operationId)) {
          self.eventBus.emit('playback:manualInteraction', message);
        }
      },
      onInteractionStarted: function onInteractionStarted(payload) {
        if (self.isCurrentOperation(operationId)) {
          self.interactionActive = true;
          self.eventBus.emit('playback:interactionStarted', payload);
        }
      },
      onInteractionEnded: function onInteractionEnded(payload) {
        if (self.isCurrentOperation(operationId)) {
          self.interactionActive = false;
          self.eventBus.emit('playback:interactionEnded', payload);
        }
      },
      onError: function onError(message) {
        if (self.isCurrentOperation(operationId)) {
          if (self.awaitingUserAction || self.restoringManualCandidate || self.manualActivationInProgress) {
            self.finishWithError(message);
          } else {
            self.handleResolvedSourceFailure(message);
          }
        }
      }
      });
    } catch (error) {
      if (this.isCurrentOperation(operationId)) {
        this.handleResolvedSourceFailure(error.message || 'O player falhou ao abrir esta fonte.');
      }
    }
  };

  PlaybackService.prototype.handleAutoplayBlocked = function handleAutoplayBlocked(message) {
    this.clearStartTimeout();
    this.lastFailureMessage = message || 'A reprodução automática foi bloqueada.';

    if (this.manualActivationInProgress) {
      this.finishWithError(this.lastFailureMessage);
      return;
    }

    if (this.playerCanActivate()) {
      this.manualCandidate = {
        sourceIndex: this.sourceIndex,
        resolvedSourceIndex: this.resolvedSourceIndex,
        source: this.getResolvedSource()
      };
    }

    if (this.restoringManualCandidate) {
      this.requestUserAction();
      return;
    }

    this.advanceAfterFailure(this.lastFailureMessage);
  };

  PlaybackService.prototype.handleResolvedSourceFailure = function handleResolvedSourceFailure(message) {
    this.clearStartTimeout();
    this.lastFailureMessage = message || 'A fonte atual falhou.';

    if (this.restoringManualCandidate) {
      this.finishWithError(this.lastFailureMessage);
      return;
    }
    this.advanceAfterFailure(this.lastFailureMessage);
  };

  PlaybackService.prototype.advanceAfterFailure = function advanceAfterFailure(message) {
    if (this.resolvedSourceIndex + 1 < this.resolvedSources.length) {
      this.resolvedSourceIndex += 1;
      this.tryResolvedSource();
      return;
    }
    this.handleConfiguredSourceFailure(message);
  };

  PlaybackService.prototype.handleConfiguredSourceFailure = function handleConfiguredSourceFailure(message) {
    var sources = this.getSources();

    this.lastFailureMessage = message || this.lastFailureMessage;
    this.sourcesTried += 1;
    if (this.sourcesTried < sources.length) {
      this.sourceIndex = normalizeIndex(this.sourceIndex + 1, sources.length);
      this.eventBus.emit('playback:fallback', {
        sourceIndex: this.sourceIndex,
        sourceCount: sources.length
      });
      this.tryConfiguredSource();
      return;
    }

    if (this.manualCandidate) {
      if (this.isCurrentManualCandidate() && this.playerCanActivate()) {
        this.requestUserAction();
      } else {
        this.restoreManualCandidate();
      }
      return;
    }

    this.finishWithError(this.lastFailureMessage || 'Todas as fontes deste canal falharam.');
  };

  PlaybackService.prototype.restoreManualCandidate = function restoreManualCandidate() {
    var candidate = this.manualCandidate;

    this.restoringManualCandidate = true;
    this.sourceIndex = candidate.sourceIndex;
    this.resolvedSources = [candidate.source];
    this.resolvedSourceIndex = 0;
    this.tryResolvedSource();
  };

  PlaybackService.prototype.requestUserAction = function requestUserAction() {
    this.clearStartTimeout();
    this.awaitingUserAction = true;
    this.restoringManualCandidate = false;
    this.eventBus.emit('playback:userActionRequired', {
      channel: this.channel,
      source: this.getResolvedSource(),
      message: 'OK para iniciar esta fonte'
    });
  };

  PlaybackService.prototype.activateCurrentSource = function activateCurrentSource() {
    var activated;

    if (!this.awaitingUserAction || !this.player || !this.playerCanActivate()) {
      return false;
    }

    this.awaitingUserAction = false;
    this.manualActivationInProgress = true;
    this.eventBus.emit('playback:activationStarted', {
      interactive: this.playerUsesTimedInteraction(),
      message: 'Confirmando reprodução…'
    });
    activated = this.player.activateFromUserGesture();

    if (!activated) {
      this.finishWithError('Esta fonte não aceita ativação pelo controle remoto.');
      return false;
    }
    return true;
  };

  PlaybackService.prototype.moveSource = function moveSource(delta) {
    var sources = this.getSources();

    if (sources.length < 2) {
      this.eventBus.emit('playback:notice', 'Este canal possui apenas uma fonte.');
      return;
    }

    this.resetActivePlayback();
    this.sourceIndex = normalizeIndex(this.sourceIndex + delta, sources.length);
    this.sourcesTried = 0;
    this.manualCandidate = null;
    this.restoringManualCandidate = false;
    this.tryConfiguredSource();
  };

  PlaybackService.prototype.retry = function retry() {
    this.resetActivePlayback();
    this.sourcesTried = 0;
    this.manualCandidate = null;
    this.restoringManualCandidate = false;
    this.tryConfiguredSource();
  };

  PlaybackService.prototype.toggle = function toggle() {
    if (!this.player) {
      return false;
    }
    if (this.player.canToggle()) {
      return this.player.toggle();
    }
    if (this.playerCanReopenInteraction()) {
      return this.player.reopenInteractionWindow();
    }
    if (!this.player.canToggle()) {
      this.eventBus.emit('playback:notice', 'Play/Pause não está disponível para esta fonte incorporada.');
      return false;
    }
    return false;
  };

  PlaybackService.prototype.endInteractionWindow = function endInteractionWindow(reason) {
    if (!this.player || typeof this.player.cancelInteractionWindow !== 'function') {
      return false;
    }
    return this.player.cancelInteractionWindow(reason || 'navigation');
  };

  PlaybackService.prototype.isInteractionWindowActive = function isInteractionWindowActive() {
    return this.interactionActive;
  };

  PlaybackService.prototype.stop = function stop() {
    this.resetActivePlayback();
    this.manualCandidate = null;
    this.restoringManualCandidate = false;
  };

  PlaybackService.prototype.getSources = function getSources() {
    return this.channel && this.channel.sources ? this.channel.sources : [];
  };

  PlaybackService.prototype.getConfiguredSource = function getConfiguredSource() {
    return this.getSources()[this.sourceIndex] || null;
  };

  PlaybackService.prototype.getResolvedSource = function getResolvedSource() {
    return this.resolvedSources[this.resolvedSourceIndex] || null;
  };

  PlaybackService.prototype.getStartingMessage = function getStartingMessage() {
    var count = this.getSources().length;
    return 'Iniciando fonte ' + (this.sourceIndex + 1) + ' de ' + count + '…';
  };

  PlaybackService.prototype.createPlaybackPayload = function createPlaybackPayload(source, statusText) {
    return {
      channel: this.channel,
      source: source,
      sourceIndex: this.sourceIndex,
      sourceCount: this.getSources().length,
      playerName: this.player ? this.player.getName() : '',
      canToggle: this.player ? this.player.canToggle() : false,
      canReopenInteraction: this.playerCanReopenInteraction(),
      statusText: statusText
    };
  };

  PlaybackService.prototype.playerCanActivate = function playerCanActivate() {
    return !!(this.player && typeof this.player.canActivateFromUserGesture === 'function' && this.player.canActivateFromUserGesture());
  };

  PlaybackService.prototype.playerCanReopenInteraction = function playerCanReopenInteraction() {
    return !!(this.player && typeof this.player.canReopenInteractionWindow === 'function' && this.player.canReopenInteractionWindow());
  };

  PlaybackService.prototype.playerUsesTimedInteraction = function playerUsesTimedInteraction() {
    return !!(this.player && typeof this.player.usesTimedInteraction === 'function' && this.player.usesTimedInteraction());
  };

  PlaybackService.prototype.isCurrentManualCandidate = function isCurrentManualCandidate() {
    return !!(this.manualCandidate &&
      this.manualCandidate.sourceIndex === this.sourceIndex &&
      this.manualCandidate.resolvedSourceIndex === this.resolvedSourceIndex);
  };

  PlaybackService.prototype.finishWithError = function finishWithError(message) {
    this.clearStartTimeout();
    this.awaitingUserAction = false;
    this.restoringManualCandidate = false;
    this.manualActivationInProgress = false;
    this.interactionActive = false;
    this.eventBus.emit('playback:error', message || 'Todas as fontes deste canal falharam.');
  };

  PlaybackService.prototype.resetActivePlayback = function resetActivePlayback() {
    this.endInteractionWindow('navigation');
    this.nextOperationId();
    this.cancelPendingResolution();
    this.clearStartTimeout();
    this.releasePlayer();
    this.resolvedSources = [];
    this.resolvedSourceIndex = 0;
    this.awaitingUserAction = false;
    this.manualActivationInProgress = false;
    this.interactionActive = false;
  };

  PlaybackService.prototype.cancelPendingResolution = function cancelPendingResolution() {
    if (this.cancelResolution) {
      this.cancelResolution();
      this.cancelResolution = null;
    }
  };

  PlaybackService.prototype.releasePlayer = function releasePlayer() {
    if (this.player) {
      this.player.release();
      this.player = null;
    }
    this.interactionActive = false;
  };

  PlaybackService.prototype.clearStartTimeout = function clearStartTimeout() {
    if (this.startTimeout) {
      window.clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
  };

  PlaybackService.prototype.nextOperationId = function nextOperationId() {
    this.operationId += 1;
    return this.operationId;
  };

  PlaybackService.prototype.isCurrentOperation = function isCurrentOperation(operationId) {
    return operationId === this.operationId;
  };

  function normalizeIndex(index, length) {
    if (!length) {
      return 0;
    }
    return (index + length) % length;
  }

  namespace.services.PlaybackService = PlaybackService;
}(window.TblackTV));

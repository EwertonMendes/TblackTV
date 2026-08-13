(function defineAppState(namespace) {
  'use strict';

  function AppState(channels) {
    this.channels = channels || [];
    this.focusedChannelIndex = 0;
    this.currentChannelIndex = null;
    this.currentSourceIndex = 0;
    this.screen = 'home';
    this.isPlaying = false;
    this.hasError = false;
    this.requiresUserAction = false;
    this.iframeInteractionActive = false;
  }

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

  namespace.core.AppState = AppState;
}(window.TblackTV));

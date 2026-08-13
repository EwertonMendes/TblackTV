(function defineEventBus(namespace) {
  'use strict';

  function EventBus() {
    this.listeners = {};
  }

  EventBus.prototype.on = function on(eventName, handler) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(handler);
  };

  EventBus.prototype.emit = function emit(eventName, payload) {
    var handlers = this.listeners[eventName] || [];
    var index;

    for (index = 0; index < handlers.length; index += 1) {
      handlers[index](payload);
    }
  };

  namespace.core.EventBus = EventBus;
}(window.TblackTV));

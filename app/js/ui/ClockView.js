(function defineClockView(namespace) {
  'use strict';

  function ClockView(element) {
    this.element = element;
    this.intervalId = null;
  }

  ClockView.prototype.start = function start() {
    var self = this;

    this.stop();
    this.update();
    this.intervalId = window.setInterval(function updateClock() {
      self.update();
    }, 30000);
  };

  ClockView.prototype.update = function update() {
    var date = new Date();

    if (!this.element) {
      return;
    }
    this.element.textContent = pad(date.getHours()) + ':' + pad(date.getMinutes());
  };

  ClockView.prototype.stop = function stop() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  };

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  namespace.ui.ClockView = ClockView;
}(window.TblackTV));

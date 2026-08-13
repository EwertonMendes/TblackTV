(function defineSpatialNavigation(namespace) {
  'use strict';

  function SpatialNavigation(itemCount, columns) {
    this.itemCount = itemCount || 0;
    this.columns = columns || 1;
    this.index = 0;
  }

  SpatialNavigation.prototype.setIndex = function setIndex(index) {
    if (index >= 0 && index < this.itemCount) {
      this.index = index;
    }
    return this.index;
  };

  SpatialNavigation.prototype.move = function move(direction) {
    var next = this.index;
    var rowStart;
    var rowEnd;

    if (direction === 'left') {
      rowStart = Math.floor(this.index / this.columns) * this.columns;
      next = Math.max(rowStart, this.index - 1);
    } else if (direction === 'right') {
      rowEnd = Math.min(rowStartFromIndex(this.index, this.columns) + this.columns - 1, this.itemCount - 1);
      next = Math.min(rowEnd, this.index + 1);
    } else if (direction === 'up') {
      next = Math.max(0, this.index - this.columns);
    } else if (direction === 'down') {
      next = Math.min(this.itemCount - 1, this.index + this.columns);
    }

    this.index = next;
    return next;
  };

  function rowStartFromIndex(index, columns) {
    return Math.floor(index / columns) * columns;
  }

  namespace.core.SpatialNavigation = SpatialNavigation;
}(window.TblackTV));

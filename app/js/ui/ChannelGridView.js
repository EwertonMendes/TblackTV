(function defineChannelGridView(namespace) {
  'use strict';

  function ChannelGridView(gridElement, countElement) {
    this.gridElement = gridElement;
    this.countElement = countElement;
    this.channels = [];
    this.favoriteIds = {};
    this.cardElements = [];
    this.pageIndex = 0;
    this.pageSize = getPageSize();
  }

  ChannelGridView.prototype.render = function render(channels, favoriteIds, focusedIndex) {
    this.channels = channels || [];
    this.favoriteIds = favoriteIds || {};
    this.pageSize = getPageSize();
    this.pageIndex = Math.floor((focusedIndex || 0) / this.pageSize);
    this.renderPage();
    this.focus(focusedIndex || 0);
  };

  ChannelGridView.prototype.renderPage = function renderPage() {
    var fragment = document.createDocumentFragment();
    var start = this.pageIndex * this.pageSize;
    var end = Math.min(start + this.pageSize, this.channels.length);
    var index;

    this.gridElement.innerHTML = '';
    this.gridElement.classList.remove('channel-grid--loading');
    this.gridElement.classList.remove('channel-grid--empty');
    this.gridElement.setAttribute('aria-busy', 'false');
    this.cardElements = [];

    if (!this.channels.length) {
      this.gridElement.classList.add('channel-grid--empty');
      this.gridElement.innerHTML = '<div class="empty-catalog"><strong>Nenhum canal encontrado</strong><span>Altere a busca ou desative o filtro de favoritos.</span></div>';
      this.updateCount();
      return;
    }

    for (index = start; index < end; index += 1) {
      var card = createCard(this.channels[index], index, !!this.favoriteIds[this.channels[index].id]);
      this.cardElements.push(card);
      fragment.appendChild(card);
    }

    this.gridElement.appendChild(fragment);
    this.updateCount();
  };

  ChannelGridView.prototype.updateCount = function updateCount() {
    var pageCount = Math.max(1, Math.ceil(this.channels.length / this.pageSize));
    var countText = this.channels.length + (this.channels.length === 1 ? ' canal' : ' canais');
    if (this.channels.length > this.pageSize) {
      countText += ' • página ' + (this.pageIndex + 1) + ' de ' + pageCount;
    }
    this.countElement.textContent = countText;
  };

  ChannelGridView.prototype.focus = function focus(index) {
    var targetPage;
    var currentIndex;

    if (index < 0) {
      for (currentIndex = 0; currentIndex < this.cardElements.length; currentIndex += 1) {
        this.cardElements[currentIndex].classList.remove('is-focused');
      }
      return;
    }

    targetPage = Math.floor((index || 0) / this.pageSize);

    if (this.channels.length && targetPage !== this.pageIndex) {
      this.pageIndex = targetPage;
      this.renderPage();
    }

    for (currentIndex = 0; currentIndex < this.cardElements.length; currentIndex += 1) {
      if (parseInt(this.cardElements[currentIndex].getAttribute('data-index'), 10) === index) {
        this.cardElements[currentIndex].classList.add('is-focused');
      } else {
        this.cardElements[currentIndex].classList.remove('is-focused');
      }
    }
  };

  ChannelGridView.prototype.isFirstColumn = function isFirstColumn(index) {
    return index >= 0 && index % 4 === 0;
  };

  ChannelGridView.prototype.getPageSize = function getCurrentPageSize() {
    return this.pageSize;
  };

  function createCard(channel, index, isFavorite) {
    var card = document.createElement('article');
    var quality = channel.sources && channel.sources[0] && channel.sources[0].quality;
    card.className = 'channel-card' + (isFavorite ? ' is-favorite' : '');
    card.setAttribute('role', 'listitem');
    card.setAttribute('data-index', index);
    card.style.setProperty('--channel-accent', channel.accent);
    card.innerHTML = [
      '<div class="channel-card__header">',
        '<div class="channel-card__logo">' + escapeHtml(channel.shortName) + '</div>',
        '<div class="channel-card__badges">',
          '<span class="channel-card__favorite" aria-label="' + (isFavorite ? 'Favorito' : 'Não favorito') + '">' + favoriteIcon(isFavorite) + '</span>',
          quality ? '<span class="channel-card__quality">' + escapeHtml(quality) + 'p</span>' : '',
        '</div>',
      '</div>',
      '<div class="channel-card__body">',
        '<p class="channel-card__category">' + escapeHtml(channel.category) + '</p>',
        '<h4 class="channel-card__name">' + escapeHtml(channel.name) + '</h4>',
        '<p class="channel-card__description">' + escapeHtml(channel.description) + '</p>',
      '</div>'
    ].join('');

    return card;
  }

  function favoriteIcon(isFavorite) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path ' + (isFavorite ? '' : 'fill="none" stroke="currentColor" stroke-width="1.8" ') + 'd="m12 2.8 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-3-5.6 3 1-6.2-4.5-4.4 6.3-.9L12 2.8Z"/></svg>';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getPageSize() {
    return window.innerWidth && window.innerWidth <= 1500 ? 4 : 8;
  }

  namespace.ui.ChannelGridView = ChannelGridView;
}(window.TblackTV));

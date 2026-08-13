(function defineChannelGridView(namespace) {
  'use strict';

  function ChannelGridView(gridElement, countElement) {
    this.gridElement = gridElement;
    this.countElement = countElement;
    this.cardElements = [];
  }

  ChannelGridView.prototype.render = function render(channels) {
    var fragment = document.createDocumentFragment();
    var index;

    this.gridElement.innerHTML = '';
    this.cardElements = [];

    for (index = 0; index < channels.length; index += 1) {
      var card = createCard(channels[index], index);
      this.cardElements.push(card);
      fragment.appendChild(card);
    }

    this.gridElement.appendChild(fragment);
    this.countElement.textContent = channels.length + (channels.length === 1 ? ' canal' : ' canais');
  };

  ChannelGridView.prototype.focus = function focus(index) {
    var currentIndex;

    for (currentIndex = 0; currentIndex < this.cardElements.length; currentIndex += 1) {
      if (currentIndex === index) {
        this.cardElements[currentIndex].classList.add('is-focused');
      } else {
        this.cardElements[currentIndex].classList.remove('is-focused');
      }
    }
  };

  function createCard(channel, index) {
    var card = document.createElement('article');
    card.className = 'channel-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('data-index', index);
    card.style.setProperty('--channel-accent', channel.accent);
    card.innerHTML = [
      '<div class="channel-card__header">',
        '<div class="channel-card__logo">' + escapeHtml(channel.shortName) + '</div>',
        '<div class="channel-card__live"><span></span> AO VIVO</div>',
      '</div>',
      '<div class="channel-card__body">',
        '<p class="channel-card__category">' + escapeHtml(channel.category) + '</p>',
        '<h4 class="channel-card__name">' + escapeHtml(channel.name) + '</h4>',
        '<p class="channel-card__description">' + escapeHtml(channel.description) + '</p>',
      '</div>'
    ].join('');

    return card;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  namespace.ui.ChannelGridView = ChannelGridView;
}(window.TblackTV));

(function defineRemotePlaylistCatalogService(namespace) {
  'use strict';

  var DEFAULT_TIMEOUT_MS = 15000;
  var CACHE_PREFIX = 'tblacktv.remote-playlist.';

  function RemotePlaylistCatalogService(requestFactory) {
    this.requestFactory = requestFactory || createRequest;
  }

  RemotePlaylistCatalogService.prototype.load = function load(playlists, localChannels, callbacks) {
    var self = this;
    var enabled = (playlists || []).filter(function onlyEnabled(item) {
      return item && item.enabled !== false && item.url;
    });
    var pending = enabled.length;
    var documents = [];
    var warnings = [];

    if (!pending) {
      callbacks.onSuccess(clone(localChannels || []), { remoteCount: 0, warnings: [] });
      return;
    }

    enabled.forEach(function loadPlaylist(playlist) {
      self.fetchPlaylist(playlist, function onResult(content, fromCache, errorMessage) {
        if (content) {
          try {
            documents.push({
              playlist: playlist,
              entries: parsePlaylist(content, playlist)
            });
            if (fromCache) {
              warnings.push(playlist.label + ' carregada do cache local.');
            }
          } catch (error) {
            warnings.push(playlist.label + ': ' + (error.message || error));
          }
        } else if (errorMessage) {
          warnings.push(errorMessage);
        }

        pending -= 1;
        if (callbacks.onProgress) {
          callbacks.onProgress(enabled.length - pending, enabled.length);
        }
        if (!pending) {
          callbacks.onSuccess(mergeCatalogs(localChannels || [], documents), {
            remoteCount: documents.length,
            warnings: warnings
          });
        }
      });
    });
  };

  RemotePlaylistCatalogService.prototype.fetchPlaylist = function fetchPlaylist(playlist, callback) {
    var request = this.requestFactory();
    var timeoutId;
    var completed = false;
    var cacheKey = CACHE_PREFIX + playlist.id;

    function finish(content, fromCache, errorMessage) {
      if (completed) {
        return;
      }
      completed = true;
      window.clearTimeout(timeoutId);
      callback(content, fromCache, errorMessage);
    }

    function fallback(message) {
      var cached = readCache(cacheKey);
      if (cached) {
        finish(cached, true, message);
      } else {
        finish('', false, message);
      }
    }

    request.onreadystatechange = function onReadyStateChange() {
      if (request.readyState !== 4 || completed) {
        return;
      }
      if (isSuccessfulStatus(request.status) && request.responseText) {
        writeCache(cacheKey, request.responseText);
        finish(request.responseText, false, '');
      } else {
        fallback(playlist.label + ' respondeu com HTTP ' + request.status + '.');
      }
    };
    request.onerror = function onRequestError() {
      fallback('Não foi possível atualizar ' + playlist.label + '.');
    };
    request.ontimeout = function onRequestTimeout() {
      fallback('A atualização de ' + playlist.label + ' excedeu o tempo limite.');
    };

    timeoutId = window.setTimeout(function onFallbackTimeout() {
      try { request.abort(); } catch (error) {}
      fallback('A atualização de ' + playlist.label + ' excedeu o tempo limite.');
    }, playlist.timeoutMs || DEFAULT_TIMEOUT_MS);

    try {
      request.open('GET', withCacheBuster(playlist.url), true);
      request.timeout = playlist.timeoutMs || DEFAULT_TIMEOUT_MS;
      request.send();
    } catch (error) {
      fallback('Não foi possível abrir ' + playlist.label + '.');
    }
  };

  function parsePlaylist(content, playlist) {
    var lines = String(content || '').replace(/\r/g, '').split('\n');
    var entries = [];
    var metadata = null;
    var referrer = '';
    var userAgent = '';
    var index;
    var line;

    for (index = 0; index < lines.length; index += 1) {
      line = lines[index].trim();
      if (!line) {
        continue;
      }
      if (line.indexOf('#EXTINF:') === 0) {
        metadata = parseExtInf(line);
        referrer = '';
        userAgent = '';
        continue;
      }
      if (line.indexOf('#EXTVLCOPT:http-referrer=') === 0) {
        referrer = line.slice('#EXTVLCOPT:http-referrer='.length).trim();
        continue;
      }
      if (line.indexOf('#EXTVLCOPT:http-user-agent=') === 0) {
        userAgent = line.slice('#EXTVLCOPT:http-user-agent='.length).trim();
        continue;
      }
      if (line.charAt(0) === '#') {
        continue;
      }
      if (metadata && isHlsUrl(line)) {
        entries.push(createEntry(metadata, line, playlist, referrer, userAgent, entries.length));
      }
      metadata = null;
      referrer = '';
      userAgent = '';
    }

    if (!entries.length) {
      throw new Error('A playlist não contém streams HLS compatíveis.');
    }
    return entries;
  }

  function parseExtInf(line) {
    var commaIndex = findMetadataComma(line);
    var attributesText = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
    var title = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : 'Canal';
    return {
      tvgId: readAttribute(attributesText, 'tvg-id'),
      group: readAttribute(attributesText, 'group-title'),
      title: title,
      name: cleanTitle(title),
      quality: readQuality(title),
      availability: readAvailability(title)
    };
  }

  function findMetadataComma(line) {
    var inQuotes = false;
    var index;
    var character;
    for (index = 0; index < line.length; index += 1) {
      character = line.charAt(index);
      if (character === '"') {
        inQuotes = !inQuotes;
      } else if (character === ',' && !inQuotes) {
        return index;
      }
    }
    return -1;
  }

  function readAttribute(text, name) {
    var expression = new RegExp('(?:^|\\s)' + name + '="([^"]*)"', 'i');
    var match = expression.exec(text);
    return match ? match[1].trim() : '';
  }

  function createEntry(metadata, url, playlist, referrer, userAgent, index) {
    var source = {
      id: playlist.id + '-' + (index + 1),
      label: playlist.label + ' • HLS' + (metadata.quality ? ' • ' + metadata.quality + 'p' : ''),
      type: 'hls',
      url: normalizeProtocol(url),
      quality: metadata.quality,
      catalogOrigin: playlist.id,
      timeoutMs: 20000
    };
    if (referrer) {
      source.referrer = referrer;
    }
    if (userAgent) {
      source.userAgent = userAgent;
    }
    return {
      tvgId: metadata.tvgId,
      name: metadata.name,
      category: metadata.group || inferCategory(metadata.name),
      availability: metadata.availability,
      source: source
    };
  }

  function mergeCatalogs(localChannels, documents) {
    var channels = clone(localChannels);
    var byTvgId = {};
    var byName = {};

    channels.forEach(function indexLocal(channel) {
      indexChannel(channel, byTvgId, byName);
    });

    documents.forEach(function mergeDocument(document) {
      document.entries.forEach(function mergeEntry(entry) {
        var tvgKey = normalizeTvgId(entry.tvgId);
        var nameKey = normalizeText(entry.name);
        var channel = (tvgKey && byTvgId[tvgKey]) || byName[nameKey];

        if (!channel) {
          channel = createChannel(entry);
          channels.push(channel);
          indexChannel(channel, byTvgId, byName);
        } else if (entry.tvgId && !channel.tvgId) {
          channel.tvgId = entry.tvgId;
          byTvgId[tvgKey] = channel;
        }
        addSource(channel, entry.source);
      });
    });

    channels.forEach(finalizeChannel);
    channels.sort(compareChannels);
    return channels;
  }

  function createChannel(entry) {
    var stableKey = (normalizeTvgId(entry.tvgId) || normalizeText(entry.name)).replace(/\s+/g, '-');
    return {
      id: 'iptv-' + stableKey,
      tvgId: entry.tvgId,
      name: entry.name,
      shortName: createShortName(entry.name),
      category: entry.category,
      accent: createAccent(stableKey),
      description: 'Canal carregado da lista brasileira atualizada.',
      sources: []
    };
  }

  function indexChannel(channel, byTvgId, byName) {
    var tvgKey = normalizeTvgId(channel.tvgId);
    var nameKey = normalizeText(channel.name);
    if (tvgKey) {
      byTvgId[tvgKey] = channel;
    }
    if (nameKey) {
      byName[nameKey] = channel;
    }
  }

  function addSource(channel, source) {
    var duplicate = channel.sources.some(function sameUrl(existing) {
      return existing.url === source.url;
    });
    if (!duplicate) {
      channel.sources.push(source);
    }
  }

  function finalizeChannel(channel) {
    var bestQuality;
    channel.sources.sort(compareSources);
    bestQuality = channel.sources.length ? numericQuality(channel.sources[0]) : 0;
    if (channel.id.indexOf('iptv-') === 0) {
      channel.description = channel.sources.length + (channel.sources.length === 1 ? ' fonte' : ' fontes') +
        (bestQuality ? ' • melhor qualidade ' + bestQuality + 'p' : '') + ' • catálogo online';
    }
  }

  function compareSources(left, right) {
    var qualityDifference = numericQuality(right) - numericQuality(left);
    if (qualityDifference) {
      return qualityDifference;
    }
    if (!!left.official !== !!right.official) {
      return left.official ? -1 : 1;
    }
    if (isSecure(left.url) !== isSecure(right.url)) {
      return isSecure(left.url) ? -1 : 1;
    }
    return left.label.localeCompare(right.label);
  }

  function compareChannels(left, right) {
    return normalizeText(left.name).localeCompare(normalizeText(right.name));
  }

  function readQuality(title) {
    var matches = String(title).match(/\((\d{3,4})[pi]\)/ig);
    var best = 0;
    (matches || []).forEach(function pickHighest(item) {
      var value = parseInt(item.replace(/\D/g, ''), 10) || 0;
      best = Math.max(best, value);
    });
    return best;
  }

  function cleanTitle(title) {
    return String(title)
      .replace(/\s*\(\d{3,4}[pi]\)/ig, '')
      .replace(/\s*\[(?:Geo-blocked|Not 24\/7)\]/ig, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readAvailability(title) {
    if (/\[Geo-blocked\]/i.test(title)) { return 'Geo-blocked'; }
    if (/\[Not 24\/7\]/i.test(title)) { return 'Not 24/7'; }
    return '';
  }

  function inferCategory(name) {
    var value = normalizeText(name);
    if (/sport|futebol|combate|n sports|ge fast/.test(value)) { return 'Esportes'; }
    if (/news|noticia|jovem pan|cnn/.test(value)) { return 'Notícias'; }
    if (/kids|cartoon|infantil|gloob/.test(value)) { return 'Infantil'; }
    if (/camara|senado|assembleia|gov/.test(value)) { return 'Público'; }
    if (/gospel|igreja|relig|evangel/.test(value)) { return 'Religioso'; }
    if (/music|musica|radio/.test(value)) { return 'Música'; }
    return 'TV Brasil';
  }

  function createShortName(name) {
    var words = String(name).replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    var initials;
    if (words.length > 1) {
      initials = words.map(function firstLetter(word) { return word.charAt(0); }).join('');
      return initials.slice(0, 6).toUpperCase();
    }
    return String(name).slice(0, 6).toUpperCase();
  }

  function createAccent(value) {
    var colors = ['#3159c7', '#7b4dcc', '#087f72', '#b15b27', '#a33d65', '#22709b', '#54742a'];
    var hash = 0;
    var index;
    for (index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function normalizeTvgId(value) {
    return normalizeText(String(value || '').replace(/@(SD|HD)$/i, ''));
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase()
      .replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i').replace(/[óòôõö]/g, 'o')
      .replace(/[úùûü]/g, 'u').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function numericQuality(source) {
    return typeof source.quality === 'number' ? source.quality : parseInt(source.quality, 10) || 0;
  }

  function isHlsUrl(url) {
    var value = String(url || '').toLowerCase();
    return /^https?:\/\//.test(value) && /\.m3u8(?:[?#]|$)/.test(value);
  }

  function isSecure(url) {
    return String(url || '').indexOf('https://') === 0;
  }

  function normalizeProtocol(url) {
    return String(url).indexOf('//') === 0 ? 'https:' + url : String(url);
  }

  function withCacheBuster(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'tblacktv=' + new Date().getTime();
  }

  function readCache(key) {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : '';
    } catch (error) {
      return '';
    }
  }

  function writeCache(key, content) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(key, content);
      }
    } catch (error) {}
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isSuccessfulStatus(status) {
    return status === 0 || (status >= 200 && status < 300);
  }

  function createRequest() {
    return new XMLHttpRequest();
  }

  namespace.services.RemotePlaylistCatalogService = RemotePlaylistCatalogService;
}(window.TblackTV));

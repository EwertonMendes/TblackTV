(function defineSourceResolver(namespace) {
  'use strict';

  var DEFAULT_RESOLVE_TIMEOUT_MS = 10000;

  function SourceResolver(requestFactory) {
    this.requestFactory = requestFactory || createRequest;
  }

  SourceResolver.prototype.resolve = function resolve(source, callbacks) {
    if (source.type === 'm3u') {
      return this.resolveM3u(source, callbacks);
    }

    callbacks.onSuccess([copySource(source)]);
    return noop;
  };

  SourceResolver.prototype.resolveM3u = function resolveM3u(source, callbacks) {
    var request = this.requestFactory();
    var timeoutId;
    var completed = false;

    function finish(handler, payload) {
      if (completed) {
        return;
      }
      completed = true;
      window.clearTimeout(timeoutId);
      handler(payload);
    }

    request.onreadystatechange = function onReadyStateChange() {
      var entries;

      if (request.readyState !== 4 || completed) {
        return;
      }

      if (!isSuccessfulStatus(request.status)) {
        finish(callbacks.onError, 'A playlist M3U respondeu com HTTP ' + request.status + '.');
        return;
      }

      entries = parseM3u(request.responseText, source);
      if (!entries.length) {
        finish(callbacks.onError, 'A playlist M3U não contém fontes reproduzíveis.');
        return;
      }

      finish(callbacks.onSuccess, entries);
    };

    request.onerror = function onRequestError() {
      finish(callbacks.onError, 'Não foi possível carregar a playlist M3U. Verifique a URL e o CORS.');
    };

    timeoutId = window.setTimeout(function onResolveTimeout() {
      try { request.abort(); } catch (error) {}
      finish(callbacks.onError, 'A playlist M3U demorou demais para responder.');
    }, source.resolveTimeoutMs || DEFAULT_RESOLVE_TIMEOUT_MS);

    request.open('GET', source.url, true);
    request.send();

    return function cancelResolution() {
      if (completed) {
        return;
      }
      completed = true;
      window.clearTimeout(timeoutId);
      try { request.abort(); } catch (error) {}
    };
  };

  function parseM3u(content, parentSource) {
    var lines = String(content || '').replace(/\r/g, '').split('\n');
    var entries = [];
    var pendingLabel = '';
    var index;
    var line;

    for (index = 0; index < lines.length; index += 1) {
      line = lines[index].trim();

      if (!line) {
        continue;
      }

      if (line.indexOf('#EXTINF:') === 0) {
        pendingLabel = readExtInfLabel(line);
        continue;
      }

      if (line.charAt(0) === '#') {
        continue;
      }

      entries.push({
        id: parentSource.id + '-entry-' + (entries.length + 1),
        label: pendingLabel ? parentSource.label + ' • ' + pendingLabel : parentSource.label,
        type: inferSourceType(line),
        url: resolveUrl(parentSource.url, line),
        timeoutMs: parentSource.timeoutMs
      });
      pendingLabel = '';
    }

    return entries;
  }

  function readExtInfLabel(line) {
    var commaIndex = line.indexOf(',');
    return commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : '';
  }

  function inferSourceType(url) {
    var cleanUrl = url.split('?')[0].toLowerCase();

    if (/\.m3u8$/.test(cleanUrl)) {
      return 'hls';
    }
    if (/\.mpd$/.test(cleanUrl)) {
      return 'dash';
    }
    return 'video';
  }

  function resolveUrl(playlistUrl, entryUrl) {
    var anchor;

    if (/^[a-z]+:/i.test(entryUrl) || entryUrl.indexOf('//') === 0) {
      return normalizeProtocol(entryUrl);
    }

    anchor = document.createElement('a');
    anchor.href = playlistUrl;
    anchor.href = anchor.href.slice(0, anchor.href.lastIndexOf('/') + 1) + entryUrl;
    return anchor.href;
  }

  function normalizeProtocol(url) {
    return url.indexOf('//') === 0 ? 'https:' + url : url;
  }

  function copySource(source) {
    var result = {};
    var key;

    for (key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        result[key] = source[key];
      }
    }
    result.url = normalizeProtocol(result.url);
    return result;
  }

  function isSuccessfulStatus(status) {
    return status === 0 || (status >= 200 && status < 300);
  }

  function createRequest() {
    return new XMLHttpRequest();
  }

  function noop() {}

  namespace.services.SourceResolver = SourceResolver;
}(window.TblackTV));

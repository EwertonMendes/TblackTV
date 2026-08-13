(function defineCatalogService(namespace) {
  'use strict';

  var SUPPORTED_SOURCE_TYPES = {
    hls: true,
    dash: true,
    video: true,
    iframe: true,
    m3u: true
  };

  var DEFAULT_REQUEST_TIMEOUT_MS = 3500;
  var CACHE_KEY = 'tblacktv.catalog.v1';

  function CatalogService(catalogUrl, profilesUrl, requestFactory, fallbackDocuments) {
    this.catalogUrl = catalogUrl;
    this.profilesUrl = profilesUrl;
    this.requestFactory = requestFactory || createRequest;
    this.fallbackDocuments = fallbackDocuments || {};
  }

  CatalogService.prototype.loadEmbedded = function loadEmbedded(onSuccess, onError) {
    var profiles;
    var channels;

    try {
      profiles = validateProfiles(cloneDocument(this.fallbackDocuments.profiles));
      channels = validateCatalog(cloneDocument(this.fallbackDocuments.catalog), profiles);
      onSuccess({
        channels: channels,
        profiles: profiles,
        origin: 'embedded',
        warning: ''
      });
    } catch (error) {
      onError('O catálogo incorporado é inválido: ' + (error.message || error));
    }
  };

  CatalogService.prototype.load = function load(onSuccess, onError) {
    var self = this;
    var completed = false;
    var catalogDocument = null;
    var profileDocument = null;

    function deliver(catalog, profileDocument, origin, warning) {
      var profiles;
      var channels;

      if (completed) {
        return;
      }
      profiles = validateProfiles(cloneDocument(profileDocument));
      channels = validateCatalog(cloneDocument(catalog), profiles);

      completed = true;
      if (origin === 'network') {
        writeCache(catalog, profileDocument);
      }
      onSuccess({
        channels: channels,
        profiles: profiles,
        origin: origin,
        warning: warning || ''
      });
    }

    function succeed(catalog, profileDocument) {
      try {
        deliver(catalog, profileDocument, 'network');
      } catch (error) {
        useFallback('Configuração inválida: ' + (error.message || error));
      }
    }

    function useFallback(reason) {
      var cached = readCache();

      if (completed) {
        return;
      }
      if (cached) {
        try {
          deliver(cached.catalog, cached.profiles, 'cache', reason);
          return;
        } catch (cacheError) {
          clearCache();
        }
      }
      if (self.fallbackDocuments.catalog && self.fallbackDocuments.profiles) {
        try {
          deliver(self.fallbackDocuments.catalog, self.fallbackDocuments.profiles, 'embedded', reason);
          return;
        } catch (fallbackError) {
          reason += ' Catálogo incorporado inválido: ' + (fallbackError.message || fallbackError) + '.';
        }
      }
      completed = true;
      onError(reason + ' O catálogo de emergência também não está disponível.');
    }

    function deliverNetworkWhenReady() {
      if (!completed && catalogDocument && profileDocument) {
        succeed(catalogDocument, profileDocument);
      }
    }

    loadJson(this.profilesUrl, this.requestFactory, function onProfilesLoaded(document) {
      profileDocument = document;
      deliverNetworkWhenReady();
    }, useFallback);
    loadJson(this.catalogUrl, this.requestFactory, function onCatalogLoaded(document) {
      catalogDocument = document;
      deliverNetworkWhenReady();
    }, useFallback);
  };

  function loadJson(url, requestFactory, onSuccess, onError) {
    var request = requestFactory();
    var completed = false;
    var timeoutId;

    function fail(message) {
      if (completed) {
        return;
      }
      completed = true;
      window.clearTimeout(timeoutId);
      try { request.abort(); } catch (error) {}
      onError(message);
    }

    request.onreadystatechange = function onReadyStateChange() {
      var data;

      if (request.readyState !== 4 || completed) {
        return;
      }

      if (!isSuccessfulStatus(request.status)) {
        fail('Não foi possível carregar "' + url + '". HTTP ' + request.status + '.');
        return;
      }

      try {
        data = JSON.parse(request.responseText);
      } catch (error) {
        fail('O arquivo "' + url + '" não contém JSON válido.');
        return;
      }

      completed = true;
      window.clearTimeout(timeoutId);
      onSuccess(data);
    };

    request.onerror = function onRequestError() {
      fail('Não foi possível carregar "' + url + '".');
    };

    request.ontimeout = function onRequestTimeout() {
      fail('O carregamento de "' + url + '" excedeu o tempo limite.');
    };

    timeoutId = window.setTimeout(function onFallbackTimeout() {
      fail('O carregamento de "' + url + '" excedeu o tempo limite.');
    }, DEFAULT_REQUEST_TIMEOUT_MS);

    try {
      request.open('GET', url, true);
      request.timeout = DEFAULT_REQUEST_TIMEOUT_MS;
      request.send();
    } catch (error) {
      fail('Não foi possível abrir "' + url + '".');
    }
  }

  function cloneDocument(document) {
    return JSON.parse(JSON.stringify(document));
  }

  function readCache() {
    var value;

    try {
      value = window.localStorage ? window.localStorage.getItem(CACHE_KEY) : null;
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache(catalog, profiles) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ catalog: catalog, profiles: profiles }));
      }
    } catch (error) {}
  }

  function clearCache() {
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(CACHE_KEY);
      }
    } catch (error) {}
  }

  function validateProfiles(document) {
    var profiles = {};

    if (!document || document.schemaVersion !== 1 || !Array.isArray(document.profiles)) {
      throw new Error('schemaVersion deve ser 1 e "profiles" deve ser uma lista.');
    }

    document.profiles.forEach(function validateProfile(profile, profileIndex) {
      var path = 'profiles[' + profileIndex + ']';

      requireText(profile.id, path + '.id');
      if (profiles[profile.id]) {
        throw new Error('id de perfil duplicado: "' + profile.id + '".');
      }
      if (profile.kind !== 'iframe') {
        throw new Error(path + '.kind deve ser "iframe".');
      }

      profiles[profile.id] = profile;
    });

    return profiles;
  }

  function validateCatalog(catalog, profiles) {
    var channels;
    var channelIds = {};

    if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.channels)) {
      throw new Error('schemaVersion deve ser 1 e "channels" deve ser uma lista.');
    }

    channels = catalog.channels.filter(function validateChannel(channel, channelIndex) {
      var path = 'channels[' + channelIndex + ']';
      var sourceIds = {};

      if (channel.enabled === false) {
        return false;
      }

      requireText(channel.id, path + '.id');
      requireText(channel.name, path + '.name');
      requireText(channel.shortName, path + '.shortName');

      if (channelIds[channel.id]) {
        throw new Error('id de canal duplicado: "' + channel.id + '".');
      }
      channelIds[channel.id] = true;

      if (!Array.isArray(channel.sources)) {
        throw new Error(path + '.sources deve ser uma lista.');
      }

      channel.sources = channel.sources.filter(function validateSource(source, sourceIndex) {
        var sourcePath = path + '.sources[' + sourceIndex + ']';

        if (source.enabled === false) {
          return false;
        }

        requireText(source.id, sourcePath + '.id');
        requireText(source.label, sourcePath + '.label');
        requireText(source.type, sourcePath + '.type');
        requireText(source.url, sourcePath + '.url');

        if (!SUPPORTED_SOURCE_TYPES[source.type]) {
          throw new Error(sourcePath + '.type não suportado: "' + source.type + '".');
        }
        if (sourceIds[source.id]) {
          throw new Error('id de fonte duplicado em "' + channel.id + '": "' + source.id + '".');
        }
        sourceIds[source.id] = true;

        if (source.playerProfile) {
          requireText(source.playerProfile, sourcePath + '.playerProfile');
          if (source.type !== 'iframe') {
            throw new Error(sourcePath + '.playerProfile só pode ser usado em fontes iframe.');
          }
          if (!profiles[source.playerProfile]) {
            throw new Error(sourcePath + '.playerProfile referencia um perfil inexistente.');
          }
        }

        validatePositiveNumber(source.timeoutMs, sourcePath + '.timeoutMs');
        validatePositiveNumber(source.resolveTimeoutMs, sourcePath + '.resolveTimeoutMs');
        if (source.sandbox) {
          if (source.type !== 'iframe') {
            throw new Error(sourcePath + '.sandbox só pode ser usado em fontes iframe.');
          }
          requireText(source.sandbox, sourcePath + '.sandbox');
        }
        return true;
      });

      if (!channel.sources.length) {
        throw new Error('o canal "' + channel.id + '" não possui fontes habilitadas.');
      }
      return true;
    });

    if (!channels.length) {
      throw new Error('nenhum canal habilitado foi encontrado.');
    }

    return channels;
  }

  function validatePositiveNumber(value, path) {
    if (typeof value !== 'undefined' && (typeof value !== 'number' || value <= 0)) {
      throw new Error(path + ' deve ser um número positivo.');
    }
  }

  function requireText(value, path) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(path + ' deve ser um texto não vazio.');
    }
  }

  function isSuccessfulStatus(status) {
    return status === 0 || (status >= 200 && status < 300);
  }

  function createRequest() {
    return new XMLHttpRequest();
  }

  namespace.services.CatalogService = CatalogService;
}(window.TblackTV));

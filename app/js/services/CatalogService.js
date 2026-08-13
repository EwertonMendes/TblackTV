(function defineCatalogService(namespace) {
  'use strict';

  var SUPPORTED_SOURCE_TYPES = {
    hls: true,
    dash: true,
    video: true,
    iframe: true,
    m3u: true
  };

  var SUPPORTED_MANUAL_FALLBACKS = {
    none: true,
    postMessage: true,
    sameOrigin: true,
    focus: true,
    acknowledge: true,
    timedInteraction: true
  };

  var SUPPORTED_SECURITY_MODES = {
    sandbox: true,
    'interaction-shield': true
  };

  var SUPPORTED_MANUAL_COMPLETIONS = {
    verified: true,
    'assume-playing': true
  };

  var SUPPORTED_VERIFICATIONS = {
    none: true,
    postMessage: true,
    sameOriginMedia: true
  };

  var DEFAULT_REQUEST_TIMEOUT_MS = 3500;
  var CACHE_KEY = 'tblacktv.catalog.v1';

  function CatalogService(catalogUrl, profilesUrl, requestFactory, fallbackDocuments) {
    this.catalogUrl = catalogUrl;
    this.profilesUrl = profilesUrl;
    this.requestFactory = requestFactory || createRequest;
    this.fallbackDocuments = fallbackDocuments || {};
  }

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
      var startup;

      requireText(profile.id, path + '.id');
      if (profiles[profile.id]) {
        throw new Error('id de perfil duplicado: "' + profile.id + '".');
      }
      if (profile.kind !== 'iframe') {
        throw new Error(path + '.kind deve ser "iframe".');
      }

      startup = profile.startup || {};
      if (startup.securityMode && !SUPPORTED_SECURITY_MODES[startup.securityMode]) {
        throw new Error(path + '.startup.securityMode não é suportado.');
      }
      if (startup.postMessageFormat && startup.postMessageFormat !== 'json') {
        throw new Error(path + '.startup.postMessageFormat deve ser "json" quando informado.');
      }
      validateUrlParams(startup.urlParams, path + '.startup.urlParams');
      validatePostMessages(startup.postMessages, path + '.startup.postMessages');
      validateSameOrigin(startup.sameOrigin, path + '.startup.sameOrigin');
      validateVerification(startup.verification, path + '.startup.verification');

      if (startup.manualFallback && !SUPPORTED_MANUAL_FALLBACKS[startup.manualFallback]) {
        throw new Error(path + '.startup.manualFallback não é suportado.');
      }
      if (startup.manualCompletion && !SUPPORTED_MANUAL_COMPLETIONS[startup.manualCompletion]) {
        throw new Error(path + '.startup.manualCompletion não é suportado.');
      }
      validatePositiveNumber(startup.timeoutMs, path + '.startup.timeoutMs');
      validatePositiveNumber(startup.manualTimeoutMs, path + '.startup.manualTimeoutMs');
      validatePositiveNumber(startup.interactionWindowMs, path + '.startup.interactionWindowMs');
      validateControls(profile.controls, path + '.controls');

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
        validateControls(source.controls, sourcePath + '.controls');
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

  function validateUrlParams(params, path) {
    var key;

    if (!params) {
      return;
    }
    if (typeof params !== 'object' || Array.isArray(params)) {
      throw new Error(path + ' deve ser um objeto.');
    }
    for (key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key) && typeof params[key] !== 'string') {
        throw new Error(path + '.' + key + ' deve ser texto.');
      }
    }
  }

  function validatePostMessages(messages, path) {
    if (!messages) {
      return;
    }
    if (!Array.isArray(messages)) {
      throw new Error(path + ' deve ser uma lista.');
    }
    messages.forEach(function validateMessage(item, index) {
      if (!item || typeof item.message !== 'object' || !Array.isArray(item.delaysMs)) {
        throw new Error(path + '[' + index + '] deve conter message e delaysMs.');
      }
      item.delaysMs.forEach(function validateDelay(delay) {
        if (typeof delay !== 'number' || delay < 0) {
          throw new Error(path + '[' + index + '].delaysMs contém um valor inválido.');
        }
      });
    });
  }

  function validateSameOrigin(config, path) {
    if (!config) {
      return;
    }
    if (config.mediaSelector) {
      requireText(config.mediaSelector, path + '.mediaSelector');
    }
    if (config.playSelector) {
      requireText(config.playSelector, path + '.playSelector');
    }
  }

  function validateVerification(verification, path) {
    if (!verification) {
      return;
    }
    if (!SUPPORTED_VERIFICATIONS[verification.type]) {
      throw new Error(path + '.type não é suportado.');
    }
    if (verification.type === 'postMessage') {
      requireText(verification.origin, path + '.origin');
      requireText(verification.eventField, path + '.eventField');
      if (!Array.isArray(verification.playingValues)) {
        throw new Error(path + '.playingValues deve ser uma lista.');
      }
    }
    if (verification.type === 'sameOriginMedia') {
      requireText(verification.mediaSelector, path + '.mediaSelector');
    }
  }

  function validateControls(controls, path) {
    if (!controls) {
      return;
    }
    if (controls.strategy !== 'postMessage') {
      throw new Error(path + '.strategy deve ser "postMessage".');
    }
    requireText(controls.targetOrigin, path + '.targetOrigin');
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

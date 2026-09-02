(function defineEmbeddedCatalog(namespace) {
  'use strict';

  /* Gerado automaticamente. Não edite manualmente. */
  namespace.config.embeddedProfiles = {
    "schemaVersion": 1,
    "profiles": [
      {
        "id": "simple-iframe",
        "kind": "iframe",
        "description": "Iframe nativo, sem autoplay, verificação ou automação do provedor."
      }
    ]
  };

  namespace.config.embeddedCatalog = {
    "schemaVersion": 1,
    "remotePlaylists": [
      {
        "id": "tblack-iptv",
        "label": "Tblack IPTV",
        "url": "https://ewertonmendes.github.io/tblack-iptv/playlist.m3u",
        "enabled": true,
        "timeoutMs": 15000,
        "sourcePriority": 1000
      }
    ],
    "channels": []
  };
}(window.TblackTV));

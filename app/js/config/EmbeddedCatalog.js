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
        "id": "iptv-org-br",
        "label": "IPTV-org Brasil",
        "url": "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/br.m3u",
        "enabled": true,
        "timeoutMs": 15000
      },
      {
        "id": "tblacktv-resolved",
        "label": "TblackTV • canais resolvidos",
        "url": "https://raw.githubusercontent.com/EwertonMendes/TblackTV-M3U-Resolver/refs/heads/master/public/playlist.m3u",
        "enabled": true,
        "timeoutMs": 15000
      }
    ],
    "channels": [
      {
        "id": "tv-brasil",
        "tvgId": "TVBrasil.br@SD",
        "name": "TV Brasil",
        "shortName": "TV",
        "category": "TV aberta",
        "accent": "#2f73da",
        "description": "Jornalismo, cultura, esportes e programação pública.",
        "sources": [
          {
            "id": "ebc-hls",
            "label": "EBC • HLS oficial • 720p",
            "type": "hls",
            "url": "https://tvbrasil-stream.ebc.com.br/index.m3u8",
            "quality": 720,
            "official": true,
            "timeoutMs": 20000
          },
          {
            "id": "local-m3u",
            "label": "Playlist M3U local",
            "type": "m3u",
            "url": "config/playlists/tv-brasil.m3u",
            "quality": 720,
            "timeoutMs": 20000
          }
        ]
      },
      {
        "id": "canal-gov",
        "tvgId": "CanalGov.br@SD",
        "name": "Canal Gov",
        "shortName": "GOV",
        "category": "Notícias",
        "accent": "#158a64",
        "description": "Notícias, eventos e transmissões do Governo Federal.",
        "sources": [
          {
            "id": "ebc-hls",
            "label": "EBC • HLS oficial",
            "type": "hls",
            "url": "https://canalgov-stream.ebc.com.br/index.m3u8",
            "official": true
          }
        ]
      },
      {
        "id": "canal-educacao",
        "tvgId": "CanalEducacao.br@SD",
        "name": "Canal Educação",
        "shortName": "EDU",
        "category": "Educação",
        "accent": "#b44ed1",
        "description": "Conteúdo educacional e produções da comunicação pública.",
        "sources": [
          {
            "id": "ebc-hls",
            "label": "EBC • HLS oficial",
            "type": "hls",
            "url": "https://canaleducacao-stream.ebc.com.br/index.m3u8",
            "official": true
          }
        ]
      },
      {
        "id": "tv-cultura",
        "tvgId": "TVCultura.br@SD",
        "name": "TV Cultura",
        "shortName": "CULT",
        "category": "TV aberta",
        "accent": "#2159a8",
        "description": "Cultura, educação, jornalismo e programação infantil.",
        "sources": [
          {
            "id": "tvcultura-hls",
            "label": "TV Cultura • HLS oficial",
            "type": "hls",
            "url": "https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8",
            "official": true
          }
        ]
      },
      {
        "id": "tv-camara",
        "tvgId": "TVCamara.br@SD",
        "name": "TV Câmara",
        "shortName": "CAM",
        "category": "Legislativo",
        "accent": "#007c73",
        "description": "Sessões, debates e notícias da Câmara dos Deputados.",
        "sources": [
          {
            "id": "camara-hls",
            "label": "Câmara dos Deputados • HLS oficial • 1080p",
            "type": "hls",
            "url": "https://stream3.camara.gov.br/tv1/manifest.m3u8",
            "quality": 1080,
            "official": true
          }
        ]
      },
      {
        "id": "tv-parana-turismo",
        "tvgId": "TVParanaTurismo.br@SD",
        "name": "TV Paraná Turismo",
        "shortName": "PR",
        "category": "TV pública",
        "accent": "#d17818",
        "description": "Turismo, cultura, notícias e programação do Paraná.",
        "sources": [
          {
            "id": "parana-hls",
            "label": "Governo do Paraná • HLS oficial",
            "type": "hls",
            "url": "https://aovivo.paranaeducativa.pr.gov.br/hls/tve.m3u8",
            "official": true
          }
        ]
      }
    ]
  };
}(window.TblackTV));

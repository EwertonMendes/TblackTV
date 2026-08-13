(function defineEmbeddedCatalog(namespace) {
  'use strict';

  /* Gerado por npm run sync-catalog. Não edite manualmente. */
  namespace.config.embeddedProfiles = {
    "schemaVersion": 1,
    "profiles": [
      {
        "id": "youtube-postmessage",
        "kind": "iframe",
        "startup": {
          "postMessageFormat": "json",
          "urlParams": {
            "autoplay": "1",
            "enablejsapi": "1",
            "playsinline": "1"
          },
          "postMessages": [
            {
              "message": {
                "event": "listening"
              },
              "delaysMs": [
                0,
                500
              ]
            },
            {
              "message": {
                "event": "command",
                "func": "addEventListener",
                "args": [
                  "onStateChange"
                ]
              },
              "delaysMs": [
                50,
                550
              ]
            },
            {
              "message": {
                "event": "command",
                "func": "playVideo",
                "args": []
              },
              "delaysMs": [
                100,
                700,
                1600
              ]
            }
          ],
          "verification": {
            "type": "postMessage",
            "origin": "https://www.youtube.com",
            "eventField": "event",
            "eventValue": "onStateChange",
            "stateField": "info",
            "playingValues": [
              1
            ]
          },
          "timeoutMs": 6000,
          "manualFallback": "postMessage"
        },
        "controls": {
          "strategy": "postMessage",
          "targetOrigin": "https://www.youtube.com",
          "play": {
            "event": "command",
            "func": "playVideo",
            "args": []
          },
          "pause": {
            "event": "command",
            "func": "pauseVideo",
            "args": []
          }
        }
      },
      {
        "id": "same-origin-html5",
        "kind": "iframe",
        "startup": {
          "sameOrigin": {
            "mediaSelector": "video",
            "playSelector": "[data-action=play], .vjs-big-play-button, .plyr__control--overlaid"
          },
          "verification": {
            "type": "sameOriginMedia",
            "mediaSelector": "video"
          },
          "timeoutMs": 5000,
          "manualFallback": "sameOrigin"
        }
      },
      {
        "id": "opaque-iframe",
        "kind": "iframe",
        "startup": {
          "securityMode": "interaction-shield",
          "urlParams": {
            "autoplay": "1",
            "playsinline": "1"
          },
          "verification": {
            "type": "none"
          },
          "timeoutMs": 5000,
          "manualFallback": "timedInteraction",
          "interactionWindowMs": 6000,
          "manualCompletion": "assume-playing"
        }
      }
    ]
  };

  namespace.config.embeddedCatalog = {
    "schemaVersion": 1,
    "channels": [
      {
        "id": "tv-brasil",
        "name": "TV Brasil",
        "shortName": "TV",
        "category": "TV aberta",
        "accent": "#2f73da",
        "description": "Jornalismo, cultura, esportes e programação pública.",
        "sources": [
          {
            "id": "ebc-hls",
            "label": "EBC • HLS oficial",
            "type": "hls",
            "url": "https://tvbrasil-stream.ebc.com.br/index.m3u8",
            "timeoutMs": 20000
          },
          {
            "id": "local-m3u",
            "label": "Playlist M3U • Exemplo",
            "type": "m3u",
            "url": "config/playlists/tv-brasil.m3u",
            "timeoutMs": 20000
          },
          {
            "id": "youtube-embed",
            "label": "YouTube oficial • iframe",
            "type": "iframe",
            "url": "https://www.youtube.com/embed/live_stream?channel=UCSv9d0kQegylHWpP83jWSQg&autoplay=1&enablejsapi=1",
            "playerProfile": "youtube-postmessage",
            "timeoutMs": 20000,
            "controls": {
              "strategy": "postMessage",
              "targetOrigin": "https://www.youtube.com",
              "play": {
                "event": "command",
                "func": "playVideo",
                "args": []
              },
              "pause": {
                "event": "command",
                "func": "pauseVideo",
                "args": []
              }
            }
          }
        ]
      },
      {
        "id": "canal-gov",
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
            "url": "https://canalgov-stream.ebc.com.br/index.m3u8"
          }
        ]
      },
      {
        "id": "canal-educacao",
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
            "url": "https://canaleducacao-stream.ebc.com.br/index.m3u8"
          }
        ]
      },
      {
        "id": "tv-cultura",
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
            "url": "https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8"
          }
        ]
      },
      {
        "id": "tv-camara",
        "name": "TV Câmara",
        "shortName": "CAM",
        "category": "Legislativo",
        "accent": "#007c73",
        "description": "Sessões, debates e notícias da Câmara dos Deputados.",
        "sources": [
          {
            "id": "camara-hls",
            "label": "Câmara dos Deputados • HLS oficial",
            "type": "hls",
            "url": "https://stream3.camara.gov.br/tv1/manifest.m3u8"
          }
        ]
      },
      {
        "id": "tv-parana-turismo",
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
            "url": "https://aovivo.paranaeducativa.pr.gov.br/hls/tve.m3u8"
          }
        ]
      },
      {
        "id": "globo-rj",
        "name": "Globo RJ",
        "shortName": "Globo",
        "category": "TV aberta",
        "accent": "#00378b",
        "description": "Programação da TV Globo para o Rio de Janeiro: jornalismo local, novelas, esportes e entretenimento.",
        "sources": [
          {
            "id": "rdcanais-embed",
            "label": "RD Canais • iframe",
            "type": "iframe",
            "url": "https://rdcanais.net/globorj",
            "playerProfile": "opaque-iframe",
            "timeoutMs": 20000
          }
        ]
      }
    ]
  };
}(window.TblackTV));

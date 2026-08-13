(function defineChannels(namespace) {
  'use strict';

  namespace.config.channels = [
    {
      id: 'tv-brasil',
      name: 'TV Brasil',
      shortName: 'TV',
      category: 'TV aberta',
      accent: '#2f73da',
      description: 'Jornalismo, cultura, esportes e programação pública.',
      sources: [
        {
          id: 'ebc-main',
          label: 'EBC • Automático',
          type: 'hls',
          url: 'https://tvbrasil-stream.ebc.com.br/index.m3u8'
        }
      ]
    },
    {
      id: 'canal-gov',
      name: 'Canal Gov',
      shortName: 'GOV',
      category: 'Notícias',
      accent: '#158a64',
      description: 'Notícias, eventos e transmissões do Governo Federal.',
      sources: [
        {
          id: 'ebc-main',
          label: 'EBC • 720p adaptativo',
          type: 'hls',
          url: 'https://canalgov-stream.ebc.com.br/index.m3u8'
        }
      ]
    },
    {
      id: 'canal-educacao',
      name: 'Canal Educação',
      shortName: 'EDU',
      category: 'Educação',
      accent: '#b44ed1',
      description: 'Conteúdo educacional e produções da comunicação pública.',
      sources: [
        {
          id: 'ebc-main',
          label: 'EBC • 720p adaptativo',
          type: 'hls',
          url: 'https://canaleducacao-stream.ebc.com.br/index.m3u8'
        }
      ]
    },
    {
      id: 'tv-cultura',
      name: 'TV Cultura',
      shortName: 'CULT',
      category: 'TV aberta',
      accent: '#2159a8',
      description: 'Cultura, educação, jornalismo e programação infantil.',
      sources: [
        {
          id: 'tvcultura-main',
          label: 'TV Cultura • Oficial',
          type: 'hls',
          url: 'https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8'
        }
      ]
    },
    {
      id: 'tv-camara',
      name: 'TV Câmara',
      shortName: 'CAM',
      category: 'Legislativo',
      accent: '#007c73',
      description: 'Sessões, debates e notícias da Câmara dos Deputados.',
      sources: [
        {
          id: 'camara-main',
          label: 'Câmara dos Deputados • Oficial',
          type: 'hls',
          url: 'https://stream3.camara.gov.br/tv1/manifest.m3u8'
        }
      ]
    },
    {
      id: 'tv-parana-turismo',
      name: 'TV Paraná Turismo',
      shortName: 'PR',
      category: 'TV pública',
      accent: '#d17818',
      description: 'Turismo, cultura, notícias e programação do Paraná.',
      sources: [
        {
          id: 'parana-main',
          label: 'Governo do Paraná • Oficial',
          type: 'hls',
          url: 'https://aovivo.paranaeducativa.pr.gov.br/hls/tve.m3u8'
        }
      ]
    }
  ];
}(window.TblackTV));

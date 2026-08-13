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
    }
  ];
}(window.SportsHub));

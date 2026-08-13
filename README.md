# TblackTV — TizenBrew

Hub de canais ao vivo para Smart TVs Samsung antigas, com foco em Tizen 5.0 e navegação por controle remoto.

## Instalação pelo GitHub

No TizenBrew, adicione o módulo:

```text
EwertonMendes/TblackTV@v0.2.6
```

Prefira uma tag imutável a `@master`. Cada versão de teste recebe um novo `appPath` e um número visível na Home para evitar misturas de manifesto, HTML, CSS e JavaScript mantidos em cache pelo CDN.

## Controle

Na Home:

- Setas: navegar;
- OK: abrir o canal;
- Return: sair do módulo.

No player:

- Esquerda/Direita: fonte anterior/próxima;
- Channel +/−: próximo/anterior canal;
- Return: voltar para a Home;
- OK em mídia direta: Play/Pause;
- OK em iframe: entregar o foco ao player incorporado para uma tentativa manual de Play.

Algumas combinações de Tizen e provedor não aceitam interação dentro do iframe. Nesse caso, use Return ou troque de fonte e prefira uma fonte HLS/M3U/vídeo direto.

## Estrutura

- `app/config/channels.json`: catálogo e fontes;
- `app/config/player-profiles.json`: perfil declarativo simples para iframe;
- `app/js/config/EmbeddedCatalog.js`: fallback empacotado contra DNS, CORS e JSON indisponível;
- `app/config/playlists/`: playlists M3U locais;
- `app/js/core/`: estado, eventos e navegação espacial;
- `app/js/services/`: catálogo, resolução de fontes, players e fallback;
- `app/js/ui/`: views;
- `app/js/controllers/`: coordenação da aplicação.

HLS, DASH e vídeo direto usam Samsung AVPlay quando disponível e HTML5 como fallback. Fontes incorporadas usam um iframe padrão. O app não injeta autoplay, não envia `postMessage`, não acessa o DOM do provedor e não considera a ausência de confirmação de reprodução um erro.

## Adicionando um canal

Edite `app/config/channels.json` e adicione um objeto em `channels`:

```json
{
  "id": "meu-canal",
  "name": "Meu Canal",
  "shortName": "MC",
  "category": "TV aberta",
  "accent": "#7c5cff",
  "description": "Descrição curta",
  "sources": [
    {
      "id": "principal",
      "label": "Fonte principal",
      "type": "hls",
      "url": "https://exemplo.com/live/index.m3u8",
      "timeoutMs": 20000
    },
    {
      "id": "alternativa",
      "label": "Player incorporado",
      "type": "iframe",
      "url": "https://provedor.example/player/canal",
      "playerProfile": "simple-iframe",
      "timeoutMs": 10000
    }
  ]
}
```

Tipos aceitos:

- `hls`: manifesto `.m3u8`;
- `dash`: manifesto `.mpd`;
- `video`: mídia direta, como MP4;
- `m3u`: playlist com uma ou mais URLs de mídia;
- `iframe`: URL do `src` de uma página incorporável, sem o HTML `<iframe>` completo.

A ordem de `sources` define a prioridade. Esquerda/Direita sempre permite escolher outra fonte, inclusive durante loading ou depois de um erro. Use `enabled: false` para ignorar temporariamente uma fonte.

### Iframe simples

Todas as fontes iframe usam `playerProfile: "simple-iframe"`. A URL é aberta sem alterações. O evento `load` significa somente que a página incorporada foi entregue; o TblackTV não tenta determinar se o vídeo interno está tocando.

O iframe começa sem interação para o controle continuar no TblackTV. Depois que a página carregar, OK foca o iframe; pressione OK novamente para acionar o Play interno. Return é tratado também pelos eventos nativos de Back do Tizen. A documentação da Samsung alerta que a interação com iframe em TV pode não ser suportada e pode abrir o navegador, comportamento controlado pelo Web Engine/provedor, não pelo aplicativo.

Não existe forma confiável de simultaneamente permitir um clique real em um iframe cross-origin e impedir popups ou navegação iniciados por esse clique. Para reprodução previsível na TV, prefira AVPlay com uma URL direta autorizada.

## Inicialização resiliente

O relógio e o marcador de versão iniciam sem depender da rede. Os JSONs são carregados com timeout; em falha de DNS, CDN, HTTP, CORS ou conteúdo inválido, o app usa a última cópia válida e depois `EmbeddedCatalog.js`. Assim a Home continua com canais e navegação.

Depois de alterar o catálogo ou perfis, gere novamente a entrada autocontida da TV:

```text
npm run build-tv-entry
npm test
```

O build sincroniza automaticamente o catálogo incorporado e produz o arquivo definido por `appPath` no `package.json`.

# TblackTV — TizenBrew

Protótipo de hub de canais ao vivo, desenhado para Samsung Tizen e navegação 100% por controle remoto.

## Instalação pelo GitHub

1. Crie um repositório **público** no GitHub.
2. Envie o conteúdo deste ZIP para a **raiz** do repositório (o `package.json` deve ficar na raiz).
3. Na TV abra **TizenBrew → Module Manager → Add GitHub Module**.
4. Informe `EwertonMendes/TblackTV`.
5. Volte para a Home do TizenBrew e abra **TblackTV**.

## Canais incluídos para teste

- TV Brasil — stream público oficial EBC
- Canal Gov — stream público oficial EBC
- Canal Educação — stream público oficial EBC
- TV Cultura — stream oficial publicado pela emissora
- TV Câmara — stream oficial da Câmara dos Deputados
- TV Paraná Turismo — stream oficial do Governo do Paraná

O catálogo e todas as fontes ficam centralizados em `app/config/channels.json`.

## Controle

### Home
- Setas: navegar
- OK/Enter: assistir canal
- Return/Back: sair do módulo

### Player
- Play/Pause ou OK: pausar/continuar
- Esquerda/Direita: fonte anterior/próxima
- Channel + / Channel -: próximo/anterior canal
- Return/Back: voltar para a Home

## Arquitetura

O projeto usa JavaScript compatível com engines Tizen antigas e evita dependências externas.

- `app/config/channels.json`: catálogo de canais e fontes
- `app/config/player-profiles.json`: estratégias reutilizáveis de autoplay para iframe
- `app/js/config/EmbeddedCatalog.js`: fallback empacotado para inicialização sem JSON/DNS
- `app/config/playlists/`: playlists M3U locais opcionais
- `core/`: estado, eventos e navegação espacial
- `services/`: catálogo, resolução de fontes e regras de fallback
- `services/adapters/`: adapters AVPlay, HTML5 e iframe
- `ui/`: views sem regras de negócio
- `controllers/`: orquestração da aplicação

A fábrica escolhe um player para cada fonte. HLS, DASH e vídeo direto usam **Samsung AVPlay** quando disponível e HTML5 `<video>` como fallback. Fontes incorporadas usam o `IframePlayerAdapter`. Playlists M3U são lidas pelo `SourceResolver` e transformadas em fontes diretas antes da reprodução.

As fontes são tentadas na ordem do JSON. Quando uma falha ou excede `timeoutMs`, o `PlaybackService` avança automaticamente. Também é possível trocar manualmente com Esquerda/Direita.

## Adicionando um canal

Edite `app/config/channels.json` e adicione um objeto dentro de `channels`:

```json
{
  "id": "meu-canal",
  "name": "Meu Canal",
  "shortName": "MC",
  "category": "Aberto",
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
      "label": "Player alternativo",
      "type": "iframe",
      "url": "https://provedor.example/player/canal",
      "playerProfile": "opaque-iframe"
    }
  ]
}
```

Cada canal pode ter quantas `sources` forem necessárias. IDs devem ser únicos dentro do canal e a ordem define a prioridade de fallback.

## Tipos de fonte

- `hls`: URL direta de um manifesto `.m3u8`.
- `dash`: URL direta de um manifesto `.mpd`; depende do suporte do AVPlay.
- `video`: arquivo ou stream de mídia direto, como MP4.
- `iframe`: URL de uma página de player incorporável. Informe somente a URL do `src`, não o HTML completo do iframe.
- `m3u`: playlist de texto `.m3u`. Cada URL interna é tentada em sequência antes do fallback para a próxima fonte do canal.

Uma fonte pode ser temporariamente ignorada com `"enabled": false`. `timeoutMs` controla quanto tempo o player aguarda pelo início. Para uma playlist M3U remota, `resolveTimeoutMs` controla o carregamento do arquivo; o servidor precisa permitir CORS.

### Inicialização resiliente

O relógio inicia antes de qualquer acesso de rede. Os dois JSONs de configuração são carregados em paralelo com timeout de 3,5 segundos. Se houver falha de DNS, CDN, HTTP, CORS ou JSON inválido, o app tenta a última cópia válida salva na TV e, depois, o catálogo incorporado em `app/js/config/EmbeddedCatalog.js`. A Home indica `Catálogo local`, mas navega normalmente.

Ao alterar `channels.json` ou `player-profiles.json`, execute `npm run sync-catalog`. `npm test` compara os documentos e falha se houver qualquer divergência. Essa duplicação intencional impede que uma requisição de configuração deixe a aplicação vazia.

### Perfis de autoplay para iframe

Fontes iframe devem apontar para um perfil de `app/config/player-profiles.json` usando `playerProfile`. Os perfis incluídos são:

- `youtube-postmessage`: usa a API documentada do YouTube, repete o comando Play e confirma o evento `onStateChange`;
- `same-origin-html5`: procura um `<video>` dentro de um iframe da mesma origem e confirma pelo evento `playing`;
- `opaque-iframe`: adiciona parâmetros de autoplay e, se não houver confirmação técnica, oferece uma janela interativa de 6 segundos. O iframe é bloqueado novamente ao final e a reprodução passa ao estado não verificado, pois seu estado interno cross-origin não pode ser observado.

Exemplo de fonte:

```json
{
  "id": "youtube",
  "label": "YouTube",
  "type": "iframe",
  "url": "https://www.youtube.com/embed/VIDEO_ID",
  "playerProfile": "youtube-postmessage"
}
```

A ordem de `sources` continua definindo a prioridade. O TblackTV tenta confirmar a reprodução; se a fonte não iniciar dentro do timeout do perfil, avança para a próxima. Depois de esgotar as fontes, restaura a última que aceita ativação manual e mostra `OK para iniciar esta fonte`.

Players compatíveis são carregados em um sandbox central, com scripts e reprodução permitidos, mas sem permissão para abrir popups, novas abas ou navegar a janela principal do TblackTV. Provedores que recusam sandbox usam `securityMode: "interaction-shield"`: mouse e toque permanecem bloqueados, exceto durante a janela temporária aberta pelo OK. Ao terminar, o TblackTV retrava o iframe, recupera o foco e permite outra tentativa com OK.

Durante a janela de um iframe opaco, o provedor recebe a interação real e pode tentar abrir publicidade. Isso não pode ser impedido sem bloquear também o botão Play. Perda de foco ou de visibilidade encerra a janela imediatamente; fontes que abrem obrigatoriamente um navegador externo devem ser consideradas incompatíveis e substituídas por uma API `postMessage`, conteúdo same-origin ou mídia direta.

Para cadastrar outro provedor, adicione um perfil com `urlParams`, `postMessages`, `verification`, `timeoutMs` e `manualFallback`, conforme a API oficial do player. Para interação opaca temporária, use `"manualFallback": "timedInteraction"`, `"interactionWindowMs": 6000` e `"manualCompletion": "assume-playing"`. Use `"postMessageFormat": "json"` quando o provedor exigir mensagens serializadas. Em mensagens externas, `origin` e a janela do iframe são sempre validados. Clique programático só é permitido no perfil same-origin.

### Formato antigo de controle de iframe

O formato com `controls` diretamente em `channels.json` continua aceito para compatibilidade:

```json
{
  "id": "embed-controlavel",
  "label": "Embed com controle",
  "type": "iframe",
  "url": "https://provedor.example/embed/canal",
  "controls": {
    "strategy": "postMessage",
    "targetOrigin": "https://provedor.example",
    "play": { "event": "play" },
    "pause": { "event": "pause" }
  }
}
```

`playerProfile` tem precedência quando os dois formatos estiverem presentes. O formato das mensagens deve ser exatamente o definido pelo provedor. Um iframe cross-origin sem parâmetros de autoplay, API `postMessage` ou suporte ao controle remoto não pode ser iniciado programaticamente com garantia.

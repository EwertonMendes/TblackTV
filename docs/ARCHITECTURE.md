# Arquitetura

## Objetivos

- compatibilidade com Samsung Tizen antigas;
- zero dependências em runtime;
- navegação determinística por controle;
- fontes de canais isoladas do restante da aplicação;
- player substituível;
- várias fontes e tecnologias de reprodução por canal.

## Fluxo

`AppController` coordena UI, estado e reprodução.

`CatalogService` carrega e valida `app/config/player-profiles.json` e `app/config/channels.json` em paralelo. O relógio não depende desse carregamento. Cada requisição possui timeout de 3,5 segundos e a inicialização segue a cadeia `JSON atual → última cópia válida → EmbeddedCatalog`. Assim, DNS, CDN, CORS ou um JSON corrompido não deixam a Home sem canais ou controle.

`PlaybackService` é independente da tecnologia de player. Para cada tentativa ele solicita ao `PlayerFactory` um adapter compatível com a fonte atual.

`SourceResolver` entrega fontes diretas sem alteração e expande playlists M3U em uma lista de mídias reproduzíveis. O fallback percorre primeiro as entradas resolvidas da playlist e depois as demais fontes configuradas no canal.

`PlayerFactory` escolhe:

1. `IframePlayerAdapter`, para fontes `iframe`;
2. `AvPlayAdapter`, para HLS, DASH e vídeo direto quando `webapis.avplay` existe;
3. `Html5VideoAdapter`, como fallback para mídia direta.

O catálogo JSON funciona como Repository estático. `EmbeddedCatalog.js` é sua réplica de emergência empacotada e sua igualdade é verificada nos testes. O `CatalogService` pode futuramente apontar para um endpoint remoto sem alterar views, controllers ou adapters.

## Fluxo de uma fonte

`channels.json → CatalogService → PlaybackService → SourceResolver → PlayerFactory → Adapter`

Falhas de resolução, criação, preparação ou timeout retornam ao `PlaybackService`, que tenta a próxima entrada M3U ou a próxima fonte configurada. A UI recebe apenas eventos de estado.

## Autoplay e confirmação

O `IframePlayerAdapter` usa os estados `loading`, `starting`, `playing`, `autoplay-blocked`, `interaction-required`, `interaction-active`, `playing-unverified` e `error`. O evento `load` do iframe significa apenas que a página foi carregada; `playback:ready` só é emitido depois de uma confirmação configurada ou, para um iframe opaco, depois que a janela manual termina no modo explicitamente não verificado.

O perfil define parâmetros de URL, tentativas de Play, verificação, timeout e ativação manual. Mensagens são aceitas somente quando `event.source` corresponde ao iframe e `event.origin` corresponde ao perfil. Ao trocar canal, fonte ou tela, o adapter remove listeners e cancela todos os timers.

O `PlaybackService` distingue erro técnico de autoplay bloqueado. Ele percorre todas as fontes automaticamente e guarda a última fonte ativável. Somente depois do esgotamento emite `playback:userActionRequired`; o `AppController` executa `activateFromUserGesture()` diretamente dentro do evento de OK.

Perfis opacos usam `manualFallback: "timedInteraction"`. O primeiro OK abre a janela configurada por `interactionWindowMs`; ao final, o adapter restaura `pointer-events: none`, `tabindex: -1` e o foco da tela do player. Com `manualCompletion: "assume-playing"`, isso produz `playing-unverified` sem o falso erro de confirmação. Outro OK reabre uma tentativa.

## Isolamento de conteúdo incorporado

O `IframePlayerAdapter` reaplica um sandbox seguro antes de cada navegação. São permitidos scripts, origem e apresentação de mídia, mas não formulários, `allow-popups`, `allow-popups-to-escape-sandbox` ou qualquer forma de `allow-top-navigation`. Assim, cliques no player não podem abrir novas abas nem substituir a janela principal do aplicativo.

Provedores que recusam execução dentro de sandbox usam `securityMode: "interaction-shield"`. Nesse modo, o iframe só recebe eventos durante uma janela temporária iniciada pelo usuário. Timeout, perda de foco, mudança de visibilidade, navegação ou destruição retravam o iframe e removem timers e listeners. Durante a janela, não há como impedir tecnicamente um popup do provedor sem bloquear também o clique real no Play; por isso, integrações por `postMessage`, same-origin ou mídia direta continuam preferíveis.

As superfícies do app e dos players usam `width` e `height` relativos ao viewport. A resolução de referência continua sendo 1920×1080, mas o player não ultrapassa a área útil quando o navegador possui barras ou usa uma janela menor.

O CSS entregue à TV evita `inset` e flex `gap`, ausentes no Chromium 63 do Tizen 5. Posicionamento usa `top/right/bottom/left` e espaçamento usa margens. O AVPlay calcula seu `setDisplayRect` a partir da superfície real do player, com fallback para o viewport.

## Padrões aplicados

- Adapter: AVPlay / HTML5 / iframe
- Factory: criação do player
- Resolver: transformação de playlists M3U em fontes diretas
- Observer/Event Bus: eventos de reprodução desacoplados da UI
- Controller: orquestração das regras de interação
- Repository: catálogo JSON isolado e substituível

# Arquitetura

## Objetivos

- compatibilidade com Samsung Tizen 5.0;
- zero dependências em runtime;
- navegação determinística por controle;
- múltiplas fontes e tecnologias por canal;
- falhas de rede ou player nunca bloqueiam a navegação;
- adapters substituíveis e responsabilidades pequenas.

## Fluxo

`channels.json → CatalogService → PlaybackService → SourceResolver → PlayerFactory → Adapter`

`CatalogService` busca perfis e canais com timeout. A inicialização usa `JSON atual → última cópia válida → EmbeddedCatalog`, portanto DNS, CORS ou um JSON corrompido não deixam a Home vazia.

`SourceResolver` entrega fontes diretas e expande playlists M3U. `PlaybackService` controla tentativa, timeout e fallback. O `AppController` mantém Return, Channel ± e Esquerda/Direita prioritários em loading e erro.

`PlayerFactory` escolhe:

1. `IframePlayerAdapter` para `iframe`;
2. `AvPlayAdapter` para HLS, DASH e vídeo quando AVPlay existe;
3. `Html5VideoAdapter` como fallback para mídia direta.

## Iframe

O `IframePlayerAdapter` é intencionalmente simples. Ele:

- atribui a URL configurada sem parâmetros extras;
- não solicita autoplay;
- não envia mensagens ao provedor;
- não acessa conteúdo cross-origin;
- remove sandbox por padrão, como um iframe web normal;
- aceita apenas os tokens de sandbox documentados pela Samsung quando a fonte opta por um sandbox;
- considera `load` como página entregue, sem afirmar que o vídeo está tocando;
- libera foco e interação após OK;
- remove o `src` e os listeners ao trocar fonte, canal ou voltar.

Não há máquina de estados de autoplay ou confirmação visual. Os estados locais são apenas `loading`, `ready`, `interactive`, `error` e `released`.

A Samsung documenta que iframe em TV é próprio para exibição e que a interação pode abrir o navegador. Por isso, OK dentro de um iframe é uma tentativa dependente do modelo/provedor. Fontes diretas via AVPlay são a integração recomendada para comportamento garantido.

## Foco e Return

Enquanto o iframe não recebeu OK, o foco fica no botão transparente de captura do TblackTV. A recuperação de foco possui uma trava de reentrada para impedir recursão de `focusin` no Chromium antigo.

O Back pode chegar como `keydown`, `tizenhwkey` e `backbutton`. Eventos ocorridos na mesma rajada física são deduplicados por tempo; assim um Return no player volta à Home sem o segundo evento sair imediatamente do módulo.

## Compatibilidade visual

As superfícies usam dimensões relativas ao viewport e referência 16:9. O CSS evita `inset` e `gap`, ausentes no Chromium 63 usado por Tizen 5. O AVPlay calcula `setDisplayRect` a partir da superfície real do player.

## Padrões

- Adapter: AVPlay / HTML5 / iframe;
- Factory: criação do player;
- Resolver: playlists M3U;
- Observer/Event Bus: eventos desacoplados;
- Controller: coordenação de estado, UI e controle;
- Repository: catálogo JSON com fallback incorporado.

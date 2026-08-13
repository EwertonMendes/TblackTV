# TblackTV — TizenBrew

Hub de canais ao vivo para Smart TVs Samsung antigas, com foco em Tizen 5.0 e navegação por controle remoto.

## Instalação pelo GitHub

```text
EwertonMendes/TblackTV@v0.3.0
```

Use a tag imutável em vez de `@master`. A Home desta versão mostra `Número de teste: 7`.

## Catálogo online

O catálogo local é exibido imediatamente e, em segundo plano, o app lê a lista brasileira do IPTV-org diretamente do GitHub:

```text
https://raw.githubusercontent.com/iptv-org/iptv/master/streams/br.m3u
```

Cada entrada da M3U vira um canal. Entradas com o mesmo `tvg-id`, ou com o mesmo nome normalizado quando não há identificador, são agrupadas como fontes alternativas. As fontes são ordenadas por resolução: 1080 antes de 720, depois 576, 480 e assim por diante. Em empate, a fonte oficial e HTTPS têm preferência.

A lista remota é atualizada em cada inicialização. Se GitHub, DNS ou CORS falharem, o app usa a última cópia salva na TV; se ainda não houver cache, os seis canais locais continuam funcionando.

Somente streams HLS HTTP/HTTPS da lista remota são importados. Iframes foram removidos do catálogo, embora o adapter continue no código para possível uso futuro.

## Controle

Na Home:

- Setas: navegar pela grade e pelos controles de busca;
- Channel +/−: página anterior/próxima;
- OK: abrir canal ou ativar o controle selecionado;
- Play/Pause: favoritar ou desfavoritar o canal focado;
- Return: sair do módulo.

Pressione para cima na primeira linha visível para acessar a pesquisa. Pressione OK no campo para abrir o teclado da TV. O botão com estrela alterna entre catálogo completo e somente favoritos.

No player:

- Esquerda/Direita: fonte anterior/próxima;
- Channel +/−: próximo/anterior canal;
- OK ou Play/Pause: pausar/continuar;
- Return: voltar à Home.

## Adicionando outra lista M3U

Edite `app/config/channels.json` e acrescente um item em `remotePlaylists`:

```json
{
  "id": "minha-lista-br",
  "label": "Minha lista",
  "url": "https://exemplo.com/canais-br.m3u",
  "enabled": true,
  "timeoutMs": 15000
}
```

Use IDs únicos. Se a nova lista usar os mesmos `tvg-id`, as URLs serão acrescentadas ao canal existente. Sem `tvg-id`, o app tenta mesclar pelo nome sem acentos, diferenças de maiúsculas ou pontuação. URLs repetidas não são adicionadas duas vezes.

O parser entende o formato:

```text
#EXTINF:-1 tvg-id="MeuCanal.br@SD",Meu Canal (1080p)
https://exemplo.com/meu-canal/index.m3u8
```

## Adicionando um canal local

Adicione um objeto em `channels`:

```json
{
  "id": "meu-canal",
  "tvgId": "MeuCanal.br@SD",
  "name": "Meu Canal",
  "shortName": "MC",
  "category": "TV aberta",
  "accent": "#7c5cff",
  "description": "Descrição curta",
  "sources": [
    {
      "id": "principal",
      "label": "Fonte principal • 1080p",
      "type": "hls",
      "url": "https://exemplo.com/live/index.m3u8",
      "quality": 1080,
      "official": true,
      "timeoutMs": 20000
    }
  ]
}
```

O `tvgId` permite mesclar esse canal com as listas remotas. Fontes locais aceitas no catálogo atual são `hls` e `m3u`.

## Organização e performance

O catálogo completo pode ter centenas de canais, mas a grade cria somente oito cards por página na resolução da TV — quatro em viewports menores. Busca, favoritos e navegação atuam sobre todos os canais sem manter centenas de elementos no DOM.

Favoritos são armazenados em `localStorage` usando o ID estável do canal e sobrevivem ao fechamento do app. Canais favoritos aparecem primeiro e podem ser isolados pelo filtro da Home.

## Build

Depois de alterar a configuração:

```text
npm run build-tv-entry
```

O build sincroniza `EmbeddedCatalog.js` e gera o HTML autocontido indicado por `appPath` no `package.json`.

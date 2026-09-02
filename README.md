# TblackTV — TizenBrew

Hub de canais ao vivo para Smart TVs Samsung antigas, com foco em Tizen 5.0 e navegação por controle remoto.

## Instalação pelo GitHub

```text
EwertonMendes/TblackTV@v0.4.3
```

Use a tag imutável em vez de `@master` para evitar misturar arquivos de versões diferentes no cache do TizenBrew.

## Catálogo online

O app começa com a grade vazia e baixa os canais exclusivamente deste endereço em cada abertura:

https://ewertonmendes.github.io/tblack-iptv/playlist.m3u

Não há canais incorporados, outras listas ou cache persistente de canais. Na inicialização, as cópias antigas de catálogos são removidas da TV; os favoritos são preservados.

Para atualizar sem sair do app, pressione **←** na primeira coluna, selecione **Atualizar canais** no menu e pressione **OK**. O botão mostra o carregamento e evita requisições simultâneas. Cada atualização bem-sucedida substitui todo o catálogo, incluindo a remoção de canais que saíram da playlist. As requisições incluem um parâmetro para evitar o cache HTTP.

Se a rede falhar ou a lista não contiver streams compatíveis, a grade fica vazia e uma mensagem orienta a tentar novamente pelo menu. Nenhuma lista antiga é restaurada.

Entradas com o mesmo identificador ou nome são agrupadas como fontes alternativas. São aceitos HLS, DASH e vídeos diretos. Manifests HLS em file.txt, index.txt ou __index.txt usam MSE, mantendo a compatibilidade existente do player.

## Controle

Na Home:

- Cima/Baixo/Direita: navegar somente pela grade de canais;
- Esquerda na primeira coluna: abrir o menu lateral;
- Channel +/−: página anterior/próxima;
- OK: abrir canal ou ativar a opção selecionada no menu;
- Play/Pause: favoritar ou desfavoritar o canal focado;
- Return: sair do módulo.

O menu lateral reúne catálogo completo, busca, favoritos e Atualizar canais. Na grade, Cima e Baixo nunca transferem o foco para o menu. Pressione OK em Buscar para abrir o teclado da TV; OK ou Return aplicam o filtro, fecham o teclado e devolvem a navegação à grade. Para limpar o filtro, apague o texto durante a edição ou selecione Todos os canais.

No player:

- Esquerda/Direita: fonte anterior/próxima;
- Channel +/−: próximo/anterior canal;
- OK ou Play/Pause: pausar/continuar;
- Return: voltar à Home.

## Organização e performance

O catálogo completo pode ter centenas de canais, mas a grade cria somente oito cards por página na resolução da TV — quatro em viewports menores. Busca, favoritos e navegação atuam sobre todos os canais sem manter centenas de elementos no DOM.

Favoritos são armazenados em `localStorage` usando o ID estável do canal e sobrevivem ao fechamento do app. Canais favoritos aparecem primeiro e podem ser isolados pelo filtro da Home.

## Build

Depois de alterar a configuração:

```text
npm run build-tv-entry
```

O build sincroniza somente a configuração e os perfis em `EmbeddedCatalog.js` (sem canais) e gera o HTML autocontido indicado por `appPath` no `package.json`.

# Sports Hub TV — TizenBrew

Protótipo de hub de canais ao vivo, desenhado para Samsung Tizen e navegação 100% por controle remoto.

## Instalação pelo GitHub

1. Crie um repositório **público** no GitHub.
2. Envie o conteúdo deste ZIP para a **raiz** do repositório (o `package.json` deve ficar na raiz).
3. Na TV abra **TizenBrew → Module Manager → Add GitHub Module**.
4. Informe `SEU_USUARIO/NOME_DO_REPOSITORIO`.
5. Volte para a Home do TizenBrew e abra **Sports Hub TV**.

## Canais incluídos para teste

- TV Brasil — stream público oficial EBC
- Canal Gov — stream público oficial EBC
- Canal Educação — stream público oficial EBC

As URLs ficam centralizadas em `app/js/config/channels.js` para facilitar troca, adição de fontes e manutenção.

## Controle

### Home
- Setas: navegar
- OK/Enter: assistir canal
- Return/Back: sair do módulo

### Player
- Play/Pause ou OK: pausar/continuar
- Channel + / Channel -: próximo/anterior canal
- Return/Back: voltar para a Home

## Arquitetura

O projeto usa JavaScript compatível com engines Tizen antigas e evita dependências externas.

- `config/`: catálogo de canais e fontes
- `core/`: estado, eventos e navegação espacial
- `services/`: regras de reprodução
- `services/adapters/`: adapters AVPlay/HTML5
- `ui/`: views sem regras de negócio
- `controllers/`: orquestração da aplicação

A reprodução usa **Samsung AVPlay** quando disponível e cai para HTML5 `<video>` como fallback. O padrão Adapter permite trocar a tecnologia de playback sem alterar o restante da aplicação.

## Adicionando um canal

Edite `app/js/config/channels.js`:

```js
{
  id: 'meu-canal',
  name: 'Meu Canal',
  shortName: 'MC',
  category: 'Aberto',
  accent: '#7c5cff',
  description: 'Descrição curta',
  sources: [
    {
      id: 'principal',
      label: 'Fonte principal',
      type: 'hls',
      url: 'https://exemplo.com/live/index.m3u8'
    }
  ]
}
```

É possível adicionar várias `sources`. O `PlaybackService` já tenta a próxima automaticamente quando uma fonte falha.

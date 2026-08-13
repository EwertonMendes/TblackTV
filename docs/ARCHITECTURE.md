# Arquitetura

## Objetivos

- compatibilidade com Samsung Tizen antigas;
- zero dependências em runtime;
- navegação determinística por controle;
- fontes de canais isoladas do restante da aplicação;
- player substituível;
- suporte futuro a várias fontes por canal.

## Fluxo

`AppController` coordena UI, estado e reprodução.

`PlaybackService` é independente da tecnologia de player. Ele recebe um adapter criado pelo `PlayerFactory`.

`PlayerFactory` escolhe:

1. `AvPlayAdapter`, quando `webapis.avplay` existe;
2. `Html5VideoAdapter`, como fallback.

O catálogo em `config/channels.js` funciona como Repository estático nesta primeira versão. Em uma versão futura ele pode ser substituído por JSON remoto sem alterar a UI.

## Padrões aplicados

- Adapter: AVPlay / HTML5
- Factory: criação do player
- Observer/Event Bus: eventos de reprodução desacoplados da UI
- Controller: orquestração das regras de interação
- Repository-ready config: catálogo isolado e substituível

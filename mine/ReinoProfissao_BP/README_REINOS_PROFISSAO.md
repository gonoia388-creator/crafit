# Sistema de Reino e Profissao (Bedrock)

## Script Events aceitos
- `reinos:set_kingdom <valor>`
- `reinos:set_profession <valor>`
- `reinos:open_profession_menu`
- `reinos:mark_profession_npc`
- `reinos:reset_profession`
- `reinos:refresh_display`

Tambem aceita aliases:
- `reinos:definir_reino <valor>`
- `reinos:definir_profissao <valor>`
- `reinos:abrir_menu_profissao`
- `reinos:marcar_npc_profissao`
- `reinos:resetar_profissao`

## Valores de reino
- ardena
- cinzas
- fjordur
- nevoa

## Valores de profissao
- minerador
- lenhador
- fazendeiro
- pescador
- criador
- ferreiro

## Regras de profissao
- O menu abre automaticamente no `initialSpawn` se o jogador ainda nao tiver profissao.
- A profissao pode ser escolhida apenas uma vez.
- Se tentar abrir menu/manual depois de definida: `Sua profissao ja foi definida.`

## Politica de abertura automatica
- Abertura inicial apos `40` ticks.
- Se cancelar por `UserBusy`, tenta novamente apos `30` ticks.
- Maximo de `5` tentativas automaticas.
- Se cancelar por `UserClosed`, para as tentativas.
- Se a profissao for definida, para imediatamente as tentativas.

## Exemplo com NPC/command
- `function reinos/escolher_ardena`
- `function profissoes/escolher_ferreiro`
- `function profissoes/abrir_menu`
- `function npc/marcar_profissao_npc`
- `function profissoes/resetar_profissao_admin`

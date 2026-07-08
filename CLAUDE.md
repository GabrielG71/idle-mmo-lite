# CLAUDE.md

Guia para trabalho assistido neste repo. **Fonte de verdade de design: [`PROJECT_SPEC.md`](./PROJECT_SPEC.md)** — leia antes de decisões de arquitetura/balanceamento.

## O que é

Idle/incremental RPG (inspiração Tibia, sem combate manual). Jogador define build; personagem
farma automático, inclusive offline. Diferencial de UX: rodar numa janela Picture-in-Picture
real do navegador (fase futura). Backend é **autoritativo** — cliente nunca envia loot/XP.

## Estrutura (monorepo pnpm workspaces)

```
apps/api        NestJS + TypeScript + TypeORM. REST + (futuro) WS gateway.
apps/web        Vite + React + Tailwind + shadcn/ui. Placeholder nesta fase.
packages/shared Tipos/DTOs/enums + constantes de balanceamento (compartilhado back/front).
docker-compose.yml  Postgres 16 + Redis 7.
```

Pacotes: `@idle/api`, `@idle/web`, `@idle/shared`.

## Comandos

```bash
pnpm install                 # instala tudo (raiz)
pnpm db:up                   # sobe postgres + redis (docker)
pnpm migration:run           # roda migrations TypeORM (cria schema + seed)
pnpm --filter @idle/api start:dev   # API em watch mode
pnpm --filter @idle/api test        # unit (Jest)
pnpm --filter @idle/api test:e2e    # e2e (supertest)
pnpm --filter @idle/web dev         # front placeholder
pnpm build                   # build de todos os pacotes
```

Copie `.env.example` → `.env` antes de rodar a API.

## Convenções / invariantes (NÃO quebrar)

- **Servidor autoritativo (§6.3 do spec)**: toda recompensa (XP/gold/loot) é recomputada no
  servidor a partir de `elapsed_time` + `combat_power` snapshot. Nunca aceitar esses valores
  do cliente. O cliente só *solicita* coleta.
- **Toda matemática de jogo vive em `apps/api/src/game/`.** Funções puras, determinísticas,
  testadas: `computePower`, `xpRequired`/`applyXp`, `calculateProgress`. Não espalhar fórmula
  por controllers/services.
- **Constantes de balanceamento vivem em `packages/shared`** (`balance.ts`) — o front precisa
  delas p/ exibir curvas. Tunar aqui, não hardcode espalhado.
- **`combat_power` é snapshot** persistido no character; recalculado só em mudança de build.
- **Collect é idempotente**: usa `last_collected_at` como cursor + `pessimistic_write` lock na
  transação. Evita double-collect concorrente.

## Defaults de balanceamento v0 (decisões abertas §8 — tunáveis)

Definidos em `packages/shared/src/balance.ts`:
- Curva XP: `xpRequired(n) = floor(BASE_XP * GROWTH^(n-1))`, `BASE_XP=100`, `GROWTH=1.15`.
- `combatPower = round(attack * survivabilityFactor)`; `attack`/`survivability` derivam de
  `class base * level scaling`. DPS-weighted, simples.
- 3 classes iniciais: **Warrior** (survival alto, atk médio), **Mage** (atk alto, survival baixo),
  **Rogue** (atk alto, survival médio).
- Offline cap: **8h** (`offlineCapSeconds = 28800`) por zona.

## Estado do roadmap

- **Fase 0 (DONE)**: auth (email+senha, argon2+JWT), characters, 3 classes, 1 zona, offline
  progress, collect. Sem PiP.
- **Pendente**: itens/afixos/talentos/power score (F1), zonas+bosses (F2), prestígio (F3),
  PiP (F4), leaderboards/world boss Redis+BullMQ (F5).

### TODOs conhecidos (schema pronto, lógica adiada)
- Streak de coleta, durabilidade de equipamento, consumíveis — colunas existem, sem lógica.
- Rate limit de collect via Redis (1req/5s, §6.3) — Redis provisionado mas não cabeado ainda.
- Tabelas `items` e `zone_boss_cooldowns` criadas vazias (Fase 1/2).

# CLAUDE.md

Guia para trabalho assistido neste repo. **Fonte de verdade de design: [`PROJECT_SPEC.md`](./PROJECT_SPEC.md)** — leia antes de decisões de arquitetura/balanceamento.

## O que é

Idle/incremental RPG (inspiração Tibia, sem combate manual). Jogador define build; personagem
farma automático, inclusive offline. Diferencial de UX: rodar numa janela Picture-in-Picture
real do navegador (fase futura). Backend é **autoritativo** — cliente nunca envia loot/XP.

## Estrutura (monorepo pnpm workspaces)

```
apps/api        NestJS + TypeScript + TypeORM. REST + (futuro) WS gateway.
apps/web        Vite + React + Tailwind + shadcn/ui. UI funcional (auth, personagem, mapa,
                inventário, talentos) — SPA sem router, sem PiP ainda.
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

Fase 1, em `packages/shared/src/items.ts` e `talents.ts`:
- Drop: 1 esperado a cada 30min de farm (`DROP_INTERVAL_SECONDS=1800`), cap de 16 por coleta
  (`MAX_DROPS_PER_COLLECT`, casa com o cap offline de 8h). Raridade por peso em `RARITY_CONFIG`
  (Common…Legendary), cada uma escalando stats/afixos via `statMultiplier`.
- Talentos: 1 ponto por nível (`TALENT_POINTS_PER_LEVEL`), respec custa
  `RESPEC_BASE_COST(100) * 2^respecCount`.

Fase 2, em `packages/shared/src/bosses.ts` e migration `SeedPhase2Zones`:
- 3 zonas: Greenwood (`minPowerScore=0`), Ashen Ridge (`40`), Shattered Peaks (`120`) — rates de
  xp/gold crescem com a zona, cap offline continua 8h em todas.
- 1 boss por zona, `minPowerScore` própria (pode ser > que a da zona): Bramblehide Alpha (20,
  cooldown 4h), Cinder Warden (60, cooldown 8h), Peakbound Wyrm (150, cooldown 12h). Loot
  exclusivo (`BOSS_ITEM_TEMPLATES`, ids 10-15) com piso de raridade Rare, nunca dropa no farm
  comum.

## Estado do roadmap

- **Fase 0 (DONE)**: auth (email+senha, argon2+JWT), characters, 3 classes, 1 zona, offline
  progress, collect. Sem PiP.
- **Fase 1 (DONE)**: itens com raridade/afixos, loot no collect (`rollLoot`, determinístico no
  piso + 1 drop fracionário probabilístico), árvore de talentos por classe, respec com custo
  crescente, `combat_power` agregando bônus de build (`aggregateBuildBonuses`). UI mínima
  (auth, criação de personagem, inventário, talentos) em `@idle/web`.
- **Fase 2 (DONE)**: 3 zonas com gate por power score, viagem entre zonas (`travelToZone`),
  1 boss por zona com cooldown por personagem e loot exclusivo. Painel de Mapa em `@idle/web`.
- **Pendente**: prestígio (F3), PiP (F4), leaderboards/world boss Redis+BullMQ (F5).

### Fase 1 — o que foi adicionado
- Catálogo em `packages/shared`: `items.ts` (templates, raridade, afixos, tuning de drop),
  `talents.ts` (árvores por classe, custo de respec).
- Math pura em `apps/api/src/game/`: `build.ts` (`aggregateBuildBonuses`), `loot.ts`
  (`rollLoot`), `power.ts`/`progress.ts` estendidos com bônus/multiplicadores opcionais.
- `apps/api/src/characters/settle-progress.ts`: helper único usado por collect **e** por toda
  mutação de build (equip/unequip/talentos/respec) — sempre liquida a janela pendente com o
  `combat_power` vigente antes de re-snapshotar com os bônus novos (nunca re-precifica
  retroativamente).
- Endpoints novos: `GET /characters`, `GET /characters/:id/build`,
  `GET|POST /characters/:id/items[...]/equip|unequip`,
  `POST /characters/:id/talents[/respec]`, `GET /item-templates`, `GET /talents`.

### Fase 2 — o que foi adicionado
- Catálogo em `packages/shared/src/bosses.ts` (`BossDef`, `BOSSES`) — DB só guarda o cooldown
  por personagem (`zone_boss_cooldowns`, schema já existia desde a Fase 0).
- Math pura em `apps/api/src/game/boss.ts`: `bossCooldownRemainingSeconds`, `rollBossLoot`
  (piso de raridade Rare, reaproveita `rollRarity`/`rollAffixes` de `loot.ts`).
- `settle-progress.ts` ganhou `extraXp`/`extraGold` opcionais — usado pelo kill de boss pra
  creditar a recompensa fixa no mesmo passo de liquidação/level-up/re-snapshot do farm passivo.
- `CharactersService.travelToZone`: liquida o pendente nas taxas da zona ATUAL antes de trocar
  (mesmo padrão de equip/talentos), valida `combat_power >= zone.minPowerScore`.
- Endpoints novos: `POST /characters/:id/zone`, `GET /characters/:id/bosses` (status de TODOS
  os bosses, não só o da zona atual), `POST /characters/:id/bosses/:bossId/kill`, `GET /bosses`.

### TODOs conhecidos (schema pronto, lógica adiada)
- Streak de coleta, durabilidade de equipamento, consumíveis — colunas existem, sem lógica.
- Rate limit de collect via Redis (1req/5s, §6.3) — Redis provisionado mas não cabeado ainda.

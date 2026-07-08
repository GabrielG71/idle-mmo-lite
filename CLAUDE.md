# CLAUDE.md

Guia para trabalho assistido neste repo. **Fonte de verdade de design: [`PROJECT_SPEC.md`](./PROJECT_SPEC.md)** — leia antes de decisões de arquitetura/balanceamento.

## O que é

Idle/incremental RPG (inspiração Tibia, sem combate manual). Jogador define build; personagem
farma automático, inclusive offline. Diferencial de UX: rodar numa janela Picture-in-Picture
real do navegador (Fase 4, com fallback flutuante pra browsers sem suporte). Backend é
**autoritativo** — cliente nunca envia loot/XP.

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

Fase 3, em `packages/shared/src/balance.ts`:
- Prestígio desbloqueado permanentemente ao derrotar o Peakbound Wyrm pelo menos uma vez
  (`PRESTIGE_UNLOCK_BOSS_ID=3`) — não precisa re-matar pra prestigiar de novo.
- Cada tier soma `PRESTIGE_BONUS_PCT_PER_TIER=10` (%) em `pctAttack` e `pctSurvivability`,
  permanente, agregado em `aggregateBuildBonuses` junto com itens/talentos.

## Estado do roadmap

- **Fase 0 (DONE)**: auth (email+senha, argon2+JWT), characters, 3 classes, 1 zona, offline
  progress, collect. Sem PiP.
- **Fase 1 (DONE)**: itens com raridade/afixos, loot no collect (`rollLoot`, determinístico no
  piso + 1 drop fracionário probabilístico), árvore de talentos por classe, respec com custo
  crescente, `combat_power` agregando bônus de build (`aggregateBuildBonuses`). UI mínima
  (auth, criação de personagem, inventário, talentos) em `@idle/web`.
- **Fase 2 (DONE)**: 3 zonas com gate por power score, viagem entre zonas (`travelToZone`),
  1 boss por zona com cooldown por personagem e loot exclusivo. Painel de Mapa em `@idle/web`.
- **Fase 3 (DONE)**: prestígio — reset de nível/XP desbloqueado por conteúdo (derrotar o
  Peakbound Wyrm), bônus permanente de combat_power por tier, itens/talentos/gold/zona/cooldowns
  preservados (§1 "nunca zera"). Painel de Prestígio em `@idle/web`.
- **Fase 4 (DONE)**: Document Picture-in-Picture API com fallback flutuante pra browsers sem
  suporte (Safari/Firefox), ticker via WebSocket (`ws` puro) alimentando um canvas 2D com
  sprite simples por classe. Botão "Mini-player" no Dashboard.
- **Fase 5 (EM ANDAMENTO — ver seção detalhada abaixo)**: leaderboard (Redis) DONE; world boss
  (BullMQ) parcialmente implementado, módulo desativado no `app.module.ts` até terminar.

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

### Fase 3 — o que foi adicionado
- `aggregateBuildBonuses` (`apps/api/src/game/build.ts`) ganhou parâmetro `prestigeTier`
  opcional — soma o bônus percentual permanente junto com itens/talentos. Todos os call sites
  (collect, equip/unequip, talentos, travel, boss kill) passam `character.prestigeTier`.
- `CharactersService.prestige`: liquida o pendente com o tier ANTIGO (settleAndResnapshot),
  só depois reseta `level=1`/`xp=0`, incrementa `prestigeTier` e re-snapshota `combat_power`
  com o bônus novo. Unlock é checado via existência de row em `zone_boss_cooldowns` pro boss
  configurado — não importa se o cooldown dele já expirou ou não.
- Endpoints novos: `GET /characters/:id/prestige` (status: unlocked/tier/bônus atual e
  próximo), `POST /characters/:id/prestige`.

### Fase 4 — o que foi adicionado
- `apps/api/src/realtime/character-ticker.gateway.ts` (`@nestjs/websockets` + `@nestjs/platform-ws`,
  registrado via `app.useWebSocketAdapter(new WsAdapter(app))` em `main.ts`): puro transporte,
  reenvia `CharactersService.getState` (mesmo payload de `GET /characters/:id`) a cada 1s pro
  socket autenticado. Auth via query string (`?token=&characterId=`) — única forma de
  autenticar WebSocket nativo do browser sem header custom; token pode ficar em logs de acesso,
  aceito como trade-off de v0 (rever se virar problema real).
- `AuthModule` passou a exportar `JwtModule` e `CharactersModule` a exportar `CharactersService`
  — só o gateway precisava, nenhum outro módulo foi afetado.
- Front: `useCharacterTicker` (hook) abre o WS só enquanto o mini-player está aberto — o
  Dashboard principal continua com o polling REST de 5s, sem mudança. `PipCanvas` desenha um
  sprite geométrico por classe (sem assets de imagem) + barra de XP via `requestAnimationFrame`.
  `PipLauncher` detecta suporte a `documentPictureInPicture`, usa `ReactDOM.createPortal` pra
  janela PiP real, ou cai num painel `position: fixed` (fallback Safari/Firefox).
- `vite.config.ts`: proxy `/api` ganhou `ws: true` (mesma regra de rewrite já cobre o path do
  gateway).

### Fase 5 — EM ANDAMENTO (retomar daqui)

**Leaderboard: DONE e funcional.**
- `packages/shared/src/types.ts`: `LeaderboardEntry`; `CharacterState` ganhou `nickname` (e
  `CreateCharacterDto` um `nickname?` opcional) — identidade no ranking, fallback pra
  "Classe Lv.N" quando não preenchido (fallback ainda só decidido, **não implementado no
  front** — hoje o `LeaderboardPanel` nem existe, ver pendências abaixo).
- Migration `1720000004000-Phase5.ts`: `characters.nickname` (text, nullable) +
  `CreateCharacterBodyDto`/`CharactersService.create`/`CreateCharacterScreen.tsx` já aceitam e
  persistem.
- `apps/api/src/redis/redis.module.ts` (`@Global`): provider `REDIS_CLIENT` (ioredis).
  `BullModule.forRootAsync` registrado em `app.module.ts` com a mesma config REDIS_HOST/PORT
  (já validados desde a Fase 0).
- `apps/api/src/leaderboard/`: `leaderboard.service.ts` (`refresh()` reconstrói o sorted set
  Redis `leaderboard:combat_power` a partir do Postgres via swap atômico RENAME; `getTop(limit)`
  faz `ZREVRANGE` + hidrata nickname/classe/level/prestígio numa query `IN` no Postgres),
  `leaderboard.processor.ts` (job BullMQ repetível a cada 60s + roda uma vez no
  `onModuleInit`), `leaderboard.controller.ts` (`GET /leaderboard?limit=`, sem guard).
  **Módulo ATIVO** em `app.module.ts`.

**World boss: SERVICE pronto, falta processor/controller/module (não compila sozinho ainda
como feature completa — por isso `WorldBossModule` está COMENTADO em `app.module.ts`).**
- `packages/shared/src/worldBoss.ts`: constantes (`WORLD_BOSS_MAX_HP=500_000`,
  `WORLD_BOSS_DURATION_MINUTES=15`, `WORLD_BOSS_SPAWN_INTERVAL_MINUTES=30`,
  `WORLD_BOSS_GOLD_POOL=50_000`, `WORLD_BOSS_XP_POOL=200_000`,
  `WORLD_BOSS_TOP_CONTRIBUTORS_ITEM_COUNT=3`), `WORLD_BOSS_ITEM_TEMPLATES` (ids 16-17, em
  `items.ts`), tipos `WorldBossStatus`/`WorldBossReward`/`WorldBossAttackResult`/
  `WorldBossClaimResult` — **tudo pronto e exportado, DONE**.
- `apps/api/src/game/world-boss.ts`: `computeWorldBossDamage` (1:1 com combat_power),
  `computeRewardShare` (proporcional, floor, sem divisão por zero),
  `rollWorldBossLoot` (1 template aleatório da pool, piso Rare, reaproveita
  `rollRarity`/`rollAffixes` de `loot.ts`) — **DONE, testado em `game/phase5.spec.ts`**.
- Migration (mesma `1720000004000-Phase5.ts`): tabela `world_boss_rewards` (character_id,
  event_id, gold_awarded, xp_awarded, item_template_id, item_rarity, **item_affixes** jsonb,
  claimed, created_at) + índice `(character_id, claimed)`. Entity
  `apps/api/src/world-boss/world-boss-reward.entity.ts` — **DONE**.
- `apps/api/src/world-boss/world-boss.constants.ts`: `WORLD_BOSS_QUEUE='world-boss'`,
  `SPAWN_JOB='spawn'`, `FINALIZE_JOB='finalize'` — **DONE** (placeholder mínimo).
- `apps/api/src/world-boss/world-boss.service.ts` — **DONE, mas NUNCA rodado/testado**:
  - `getStatus()`: lê hash Redis `worldboss:current` (id/hp/maxHp/endsAt/defeated).
  - `attack(characterId, userId)`: `loadOwnedCharacter` (leitura, sem lock Postgres — todo
    estado do ataque é efêmero no Redis). Script Lua atômico (`ATTACK_SCRIPT`, embutido no
    arquivo) decrementa HP e faz `ZINCRBY` na chave `worldboss:contributions:<eventId>` numa
    única chamada — evita contenção com ataques concorrentes. Edge-trigger: só marca
    `justDefeated=1` na chamada que derrubou HP de >0 pra ≤0 (evita finalizar 2×). Se
    `justDefeated`, enfileira job `FINALIZE_JOB` na fila `world-boss` (fila ainda não
    registrada em nenhum módulo — ver pendência do `BullModule.registerQueue` abaixo).
  - `listRewards`/`claimRewards(characterId, userId)`: soma recompensas não reivindicadas,
    credita via `settleAndResnapshot` com `extraXp`/`extraGold` (mesmo padrão do kill de boss
    normal), marca `claimed=true`. **TODO explícito no código**: os itens de reward
    (`itemTemplateId`/`itemRarity`/`itemAffixes`) ainda **não são instanciados como `Item`**
    no momento do claim — só gold/xp são creditados por enquanto.

**Falta pra fechar a Fase 5 (nessa ordem):**
1. `apps/api/src/world-boss/world-boss.processor.ts` (não existe ainda) — dois jobs BullMQ:
   - `spawn` (repetível a cada `WORLD_BOSS_SPAWN_INTERVAL_MINUTES`, registrado no
     `onModuleInit` igual o `LeaderboardProcessor`): só spawna se `worldboss:current` não tem
     `id` ativo; `HSET` hp=maxHp/maxHp/endsAt=now+duration/defeated=0; agenda um `finalize`
     atrasado (`delay: duration_ms`) pro caso de ninguém derrotar a tempo.
   - `finalize` (idempotente — se `worldboss:current.id !== eventId` recebido no job, já foi
     finalizado por outra chamada, no-op e retorna): lê `ZRANGE worldboss:contributions:<id>
     WITHSCORES`, calcula `computeRewardShare` do pool de gold/xp por contribuidor, insere
     `WorldBossReward` (não reivindicada) só se `gold>0 || xp>0 || (defeated && é top-3)`; se
     `defeated`, top 3 por contribuição ganham `rollWorldBossLoot()` anexado à própria row;
     limpa `worldboss:current` e `worldboss:contributions:<id>` do Redis no final.
2. `apps/api/src/world-boss/world-boss.controller.ts`: `GET /world-boss` (status, sem guard),
   `POST /characters/:characterId/world-boss/attack`,
   `GET /characters/:characterId/world-boss/rewards`,
   `POST /characters/:characterId/world-boss/rewards/claim` (todos com guard exceto o status).
3. `apps/api/src/world-boss/world-boss.module.ts`: `BullModule.registerQueue({name:'world-boss'})`
   + providers `[WorldBossService, WorldBossProcessor]` + `controllers: [WorldBossController]`.
4. Descomentar `WorldBossModule` em `app.module.ts` (2 linhas já marcadas com
   `// TODO(Fase 5, WIP)` — import e entrada no array `imports`).
5. Resolver o TODO de instanciar `Item` real no `claimRewards` (usar `manager.getRepository(Item)`
   igual o `collect`/`kill` de boss fazem, a partir de `itemTemplateId`/`itemRarity`/`itemAffixes`
   salvos na reward).
6. Frontend (nada feito ainda): `lib/api.ts` (`getLeaderboard`, `getWorldBossStatus`,
   `attackWorldBoss`, `getWorldBossRewards`, `claimWorldBossRewards`),
   `components/LeaderboardPanel.tsx` (tabela ranqueada, poll 30s, fallback "Classe Lv.N" quando
   sem nickname), `components/WorldBossPanel.tsx` (barra HP, countdown, atacar, resgatar, poll
   3s), integrar os dois no `Dashboard.tsx`.
7. Testes: `apps/api/src/game/phase5.spec.ts` já cobre a math pura (DONE). Falta
   `apps/api/test/phase5-flow.e2e-spec.ts` (registra `WsAdapter` igual os specs desde a Fase 4;
   testa `/leaderboard`; força um evento manipulando o Redis direto via client injetado, ataca
   até derrotar, faz *polling* — não `sleep` fixo — até a reward aparecer, já que o job
   `finalize` é assíncrono, diferente de tudo que veio antes).
8. Rodar `pnpm build && pnpm --filter @idle/api test && pnpm --filter @idle/api test:e2e`
   completo (Fases 0-5) antes de considerar a fase fechada.

**Estado do banco/build nesta pausa**: migration `Phase51720000004000` já **rodada** no
Postgres local (schema com `nickname` + `world_boss_rewards` já existe). `pnpm build` e
`pnpm --filter @idle/api test` estavam **verdes** no momento da pausa (56 unit tests, todas as
fases 0-4 + math pura da fase 5). `pnpm --filter @idle/api test:e2e` **não foi rodado** com o
código desta pausa — rodar antes de continuar, pra confirmar que nada regrediu.

### TODOs conhecidos (schema pronto, lógica adiada)
- Streak de coleta, durabilidade de equipamento, consumíveis — colunas existem, sem lógica.
- Rate limit de collect via Redis (1req/5s, §6.3) — Redis provisionado mas não cabeado ainda.

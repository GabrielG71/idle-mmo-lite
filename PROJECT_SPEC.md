# Idle MMO-lite — Especificação Técnica

> Documento de referência para desenvolvimento assistido via Claude Code. Contém arquitetura, modelos de dados, regras de progressão e decisões de design já tomadas. Serve como fonte de verdade — atualizar conforme o projeto evolui.

## 1. Visão geral

Jogo idle/incremental com estética RPG, inspirado em MMORPGs clássicos (Tibia) mas sem combate manual. O jogador define build (classe, equipamento, skills, zona-alvo) e o personagem farma automaticamente, inclusive offline. O diferencial de UX é rodar em uma janela **Picture-in-Picture real do navegador**, permitindo acompanhar o farm enquanto usa o restante do PC normalmente.

### Pilares de design
- **Sempre é possível subir de nível** — a curva nunca "veta" progresso, apenas o retarda.
- **Nunca "zera"** — não existe perda de progresso permanente por ausência. Perdas são de oportunidade (loot não coletado) ou temporárias (buffs, durabilidade), nunca de XP/nível base.
- **Decisão do jogador = build, não execução** — combate é 100% automático; a skill expression está em talentos, equipamento, escolha de zona e consumíveis.
- **Escalável por design** — progresso offline é calculado sob demanda (O(1) por coleta), não via tick contínuo por jogador online.

---

## 2. Loop de progressão

### 2.1 Cálculo de progresso offline
Ao invés de simular cada personagem em intervalos fixos (custo O(jogadores) constante), o progresso é calculado no momento da coleta:

```
delta_xp, delta_loot = calculate_progress(
  elapsed_seconds = now - character.last_collected_at,
  combat_power     = compute_power(character.build_snapshot),
  zone_rate_table  = zones[character.current_zone].rates,
  caps             = zones[character.current_zone].offline_caps
)
```

Regras:
- `combat_power` é recalculado a cada mudança de build (equip, talento, consumível) e persistido como snapshot — nunca recalculado a partir de dados do cliente no momento da coleta.
- Cada zona tem um **cap de acumulação offline** (ex: 8–12h de farm útil), evitando que ausências longas gerem valor desproporcional e forçando volta periódica sem punir quem não voltar.
- Todo cálculo de recompensa é feito e validado no servidor. O cliente nunca envia valores de loot/XP — apenas solicita a coleta.

### 2.2 Curva de nível e prestígio
- Requisito de XP por nível: exponencial padrão (`xp_required(n) = base * growth^n`).
- **Camadas de prestígio** (reset de nível + multiplicador permanente) desbloqueadas por **conteúdo** (derrotar boss específico), não apenas tempo — isso evita que a progressão vire puramente passiva e mantém decisão estratégica relevante em todas as fases do jogo.
- Cada prestígio subsequente reescala a curva (não a "vence"), garantindo que o jogo permaneça desafiador por muitas horas sem um teto artificial.

### 2.3 Mecanismos de "perda" (sem perda de progresso permanente)
| Mecanismo | Efeito | Reversível? |
|---|---|---|
| Streak de coleta | Multiplicador temporário de farm | Expira se não coletar em X horas, não reseta nível |
| Durabilidade de equipamento | Degrada DPS efetivo com uso | Reparável com gold/material |
| Cap de acumulação offline | Farm para de gerar valor além do cap | Sem perda, apenas oportunidade perdida |
| Buff de engajamento ativo | Bônus extra por interação (ajustar build, entrar no app) | Não afeta baseline passivo |

Perda real de progresso (itens, XP) fica restrita a sistemas **opcionais** de risco (ex: arena PvP com aposta), nunca no loop PvE principal.

---

## 3. Classes, build e itens

- **Classe base**: define curva de atributos, árvore de talentos disponível e afinidade com tipos de dano/defesa.
- **Talentos**: pontos alocáveis manualmente pelo jogador, sem respec gratuito ilimitado (custo crescente de reset, para dar peso à decisão).
- **Equipamento**: raridade, afixos (rolados dentro de ranges), sockets para runas/gemas. Fonte de build diversity.
- **Consumíveis/runas**: ativados antes de "mandar farmar" — buffs temporários, não permanentes, para incentivar retorno periódico.
- **Power score**: métrica derivada (DPS efetivo + sobrevivência ponderada) usada para gating de zona e leaderboard, não o nível bruto.

---

## 4. Mapa e conteúdo

- Zonas com gate por **power score mínimo**, não level — evita jogador travar em zona impossível e dá meta clara e mensurável.
- Inimigos comuns: farm padrão, taxa de drop constante por tempo.
- Bosses de zona: cooldown por personagem (ex: 1 kill / X horas), loot exclusivo — cria motivo de retorno sem virar spam-fest.
- Progressão de zonas deve ser desenhada para nunca ficar "resolvida" — zonas tardias continuam relevantes via drops de prestígio/reforge.

---

## 5. Picture-in-Picture

Uso da **Document Picture-in-Picture API** (suporte: Chrome/Edge desde 2023), que permite abrir uma janela always-on-top com DOM/canvas arbitrário — ao contrário do PiP de vídeo tradicional, sobrevive à troca de aba.

```js
const pipWindow = await documentPictureInPicture.requestWindow({
  width: 320,
  height: 180
});
// mover elemento de render (canvas ou componente leve) para pipWindow.document
document.querySelector('#game-widget').remove();
pipWindow.document.body.append(gameWidgetElement);
```

Diretrizes:
- Render dentro do PiP deve ser leve: canvas 2D com sprites simples, ou HTML/CSS animado. Nada de render pesado (WebGL complexo, etc).
- Estado vem via WebSocket/SSE a partir do servidor — o PiP é puramente uma view, sem lógica de jogo.
- **Fallback** para browsers sem suporte (Safari, Firefox): widget flutuante dentro da própria aba (`position: fixed`), com aviso de limitação de funcionalidade.

---

## 6. Arquitetura backend

### 6.1 Stack
| Camada | Tecnologia | Papel |
|---|---|---|
| API/Gateway | NestJS + TypeScript | REST para build/inventory/collect; WebSocket Gateway para ticker do PiP |
| Persistência | PostgreSQL | Characters, inventory, build_config, zone_progress — fonte de verdade durável |
| Cache/Realtime | Redis | Leaderboards (sorted sets), rate limit de collect, cache de hot state |
| Filas | BullMQ | Cálculo de loot de boss, distribuição de drops raros, world boss agendado |
| Infra | Docker | Ambiente padrão de dev/deploy |

### 6.2 Modelo de dados (rascunho inicial)

```sql
-- Characters: estado core, sem dados derivados
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  class_id SMALLINT NOT NULL REFERENCES classes(id),
  level INT NOT NULL DEFAULT 1,
  xp BIGINT NOT NULL DEFAULT 0,
  prestige_tier SMALLINT NOT NULL DEFAULT 0,
  current_zone_id SMALLINT NOT NULL REFERENCES zones(id),
  combat_power BIGINT NOT NULL DEFAULT 0, -- snapshot, recalculado a cada mudança de build
  last_collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice crítico para queries de offline-progress em batch
CREATE INDEX idx_characters_collect ON characters (id, last_collected_at);

-- Build: separado de characters para não inchar a tabela principal
CREATE TABLE character_builds (
  character_id UUID PRIMARY KEY REFERENCES characters(id),
  talents JSONB NOT NULL DEFAULT '{}',
  equipped_items JSONB NOT NULL DEFAULT '{}', -- slot -> item_id
  active_consumables JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id),
  template_id SMALLINT NOT NULL, -- referência ao catálogo de itens
  rarity SMALLINT NOT NULL,
  affixes JSONB NOT NULL DEFAULT '{}',
  durability SMALLINT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE zone_boss_cooldowns (
  character_id UUID NOT NULL REFERENCES characters(id),
  boss_id SMALLINT NOT NULL,
  last_kill_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (character_id, boss_id)
);
```

### 6.3 Padrões de segurança
- Todo cálculo de recompensa é **recomputável e verificável no servidor** a partir de `elapsed_time` + `build_snapshot`. Nunca aceitar valor vindo do cliente.
- Rate limit no endpoint `POST /characters/:id/collect` (Redis, ex: 1 req/5s por personagem) — evita spam e facilita auditoria de replay.
- Idempotência na coleta: usar `last_collected_at` como cursor atômico (transação com `SELECT ... FOR UPDATE` ou optimistic locking via `updated_at`), evitando double-collect em requisições concorrentes.
- Validação de build no servidor antes de persistir (ex: pontos de talento não podem exceder total disponível por nível).

---

## 7. Roadmap sugerido (fases)

1. **Fase 0 — Core loop sem PiP**: characters, classes, build simples, uma zona, cálculo de offline progress, coleta manual via UI normal.
2. **Fase 1 — Itens e talentos**: sistema de equipamento com afixos, árvore de talentos, power score.
3. **Fase 2 — Mapa e bosses**: múltiplas zonas com gating, bosses com cooldown, drops exclusivos.
4. **Fase 3 — Prestígio**: camada de reset + multiplicador, rebalanceamento de curva.
5. **Fase 4 — PiP**: Document Picture-in-Picture API, fallback para browsers sem suporte, ticker via WebSocket.
6. **Fase 5 — Social/competitivo**: leaderboards (Redis sorted sets), eventos de world boss (BullMQ agendado).

---

## 8. Decisões em aberto

- [ ] Definir fórmula exata de `combat_power` (ponderação DPS vs sobrevivência).
- [ ] Definir número de classes iniciais e diferenciação mecânica entre elas.
- [ ] Definir cap de acumulação offline por zona (horas).
- [ ] Modelo de monetização (se houver) — evitar pay-to-win dado o pilar "sempre parelho".
- [ ] Autenticação: OAuth social vs conta própria (impacta modelo de `users`).

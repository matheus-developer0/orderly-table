# Plano: SaaS para restaurantes (estilo Anota AI)

Você pediu um sistema enorme — equivalente a meses de produto. Vou entregar em fases, cada uma utilizável de ponta a ponta. Antes de começar, alguns pontos importantes:

## Ajustes técnicos necessários

- **Stack real do template:** TanStack Start (React 19 + Vite), não Next.js App Router. A arquitetura, SSR, file-based routing e server functions são equivalentes. Vou usar isso (não dá pra trocar para Next aqui).
- **Backend:** Lovable Cloud (Supabase por baixo) — Auth, Postgres, Realtime, Storage já inclusos. Sem configuração externa.
- **Firebase Cloud Messaging:** substituído por Web Push nativo + Realtime do Supabase (toast + som). FCM exige conta Firebase separada e service worker dedicado — se quiser depois, adicionamos.
- **PWA:** instalável via manifest. Service worker completo só na fase final (causa problemas no preview do Lovable durante dev).
- **Impressão térmica:** arquitetura preparada (status `printed`, fila, reimprimir), mas a ponte física (USB/Bluetooth) exige um app desktop Electron — fora do escopo web. Deixo os hooks prontos.

## Fases

### Fase 1 — Fundação (esta entrega)
- Design system: vermelho vibrante, preto, branco, amarelo suave. Cards grandes, sombras modernas, Framer Motion.
- Lovable Cloud ativado.
- Schema multi-tenant: `restaurants`, `users`, `user_roles`, `tables`, `categories`, `products`, `orders`, `suborders`, `order_items`, `notifications`. RLS em tudo, escopado por `restaurant_id`.
- Auth: dono do restaurante (email/senha) + cliente (nome + telefone, sessão leve em localStorage).
- RBAC: `owner`, `manager`, `waiter`, `kitchen`, `cashier`, `delivery` via tabela separada + função `has_role`.
- Rotas-base: `/login`, `/admin`, `/mesa/$tableId`, `/cozinha`, `/garcom`.
- Seed de demonstração (1 restaurante, 8 mesas, ~20 produtos com imagens placeholder).

### Fase 2 — Experiência do cliente
- `/mesa/$id`: identifica mesa via QR, login rápido (nome+telefone).
- Cardápio: categorias, busca, produto com adicionais/observações, destaques, promoções.
- Carrinho compartilhado em **realtime** entre pessoas da mesma mesa (subpedidos por cliente).
- Enviar pedido → vai pra cozinha/admin/garçom em tempo real.
- Status do pedido ao vivo, botão "chamar garçom", "pedir conta".
- Botão WhatsApp com resumo pré-preenchido.

### Fase 3 — Operação
- **Cozinha:** Kanban (Novo / Em Preparo / Pronto / Saiu / Cancelado), drag-and-drop, som + toast em novo pedido, modal obrigatório de motivo no cancelamento.
- **Garçom:** lista de chamados, mesas ativas, fechamento de conta com divisão por subpedido (checkbox pago, total restante).
- **Admin dashboard:** faturamento do dia, ticket médio, pedidos ativos, top produtos, gráficos (Recharts).
- **CRUD:** produtos, categorias, mesas (com geração de QR), usuários/permissões.

### Fase 4 — Polimento
- Delivery com status próprio.
- Manifest PWA + ícones + instalável.
- Pizza metade/metade, combos, borda recheada.
- Notificações push (Web Push API).
- Otimizações: skeleton, lazy loading, cache.

## Esta resposta entrega a Fase 1

Depois você testa, e me diz "fase 2" para continuar. Cada fase leva uma rodada de mensagens. Tentar entregar tudo de uma vez resultaria em código quebrado e raso — você terá um produto melhor fatiado assim.

Confirma para eu seguir com a Fase 1?

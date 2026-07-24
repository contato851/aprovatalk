# Aba "Planejamento" — rascunhos antes da aprovação

## 1. Banco de dados (migração)

- Adicionar valor `'planning'` ao enum `post_status` (antes de `'pending'`).
- Alterar o default da coluna `posts.status` para `'planning'` (novos posts nascem em rascunho).
- Nenhuma outra tabela muda; `post_media`, `post_adjustment_points`, capa e legenda continuam funcionando normalmente para posts em planejamento (todos os campos ficam opcionais na UI, mas o schema já permite).

## 2. Server functions (admin)

Em `src/lib/admin.functions.ts`:

- `createPost` / `updatePost`: aceitar `status: 'planning' | 'pending'`. Quando o form for salvo pela aba Planejamento, gravar `planning`. Editar um post existente mantém o status atual (não força volta para pending como hoje) — apenas edição de post `rejected` continua voltando para `pending`.
- Nova fn `releasePostForApproval({ id })`: carrega o post + mídia; valida obrigatórios:
  - `scheduled_at` presente
  - `caption` não vazio
  - pelo menos 1 mídia final (`post_media`) coerente com `type` (static=1 imagem, carousel≥2 imagens, video=1 vídeo)
  - `cover_url` obrigatório quando `type='video'`
  Se faltar algo, retorna `{ ok: false, missing: string[] }`. Se ok, seta `status='pending'`, limpa `client_comment` e `responded_at`.
- `getClientPosts` (ou equivalente que abastece a página do cliente no admin) já retorna todos os status; só precisamos separar por status na UI.

## 3. Server function (cliente)

Em `src/lib/client-portal.functions.ts`:

- `getClientPortal` já retorna todos os posts; a UI vai filtrar por status. Não expõe nenhuma ação nova ao cliente — posts `planning` são somente-leitura.

## 4. UI admin — `src/routes/_authenticated/clients/$clientId/index.tsx`

- Adicionar tabs no topo da página do cliente:
  - **Planejamento** (posts com status `planning`)
  - **Aprovação** (posts `pending` + `approved` + `rejected` — mantém o comportamento atual)
- Botão "+ Novo post" passa a criar por padrão em `planning` quando a aba ativa for Planejamento; na aba Aprovação continua criando como `pending` (comportamento atual).
- Cards de Planejamento: mesma miniatura 3/4, badge cinza "Planejamento", e um botão **"Liberar para aprovação"**.
  - Ao clicar chama `releasePostForApproval`. Se `missing` vier populado, toast de erro listando os campos ("Faltam: capa, legenda"). Se ok, toast de sucesso e o post desaparece da aba Planejamento e aparece em Aprovação/Pendentes.
- Ordenação: por `scheduled_at` asc, igual ao feed atual.

## 5. UI admin — `PostForm` (`src/components/talk/post-form.tsx`)

- Aceitar prop opcional `initialStatus?: 'planning' | 'pending'` para o modo `create`.
- Em modo Planejamento: todos os campos ficam opcionais no client-side (sem `required`), botão principal fica "Salvar rascunho". Data programada pode ficar vazia (usa `now()` como placeholder para permitir salvar). Mídia opcional.
- Em modo Aprovação: comportamento atual (obrigatórios como hoje).
- No modo `edit`, se o post estiver em `planning`, exibe a mesma UI relaxada + botão extra "Liberar para aprovação".

## 6. UI cliente — `src/routes/c/$token.tsx`

- Adicionar uma quarta aba **Planejamento** ao lado de Pendentes / Aprovados / Reprovados.
- Renderizar posts `planning` como lista simples por data (`dd 'de' MMM · HH'h'mm`), com:
  - miniatura (se tiver mídia final ou capa)
  - legenda (se tiver) ou "—"
  - tag visual "Em produção" (badge chartreuse suave)
  - **sem** botões aprovar/reprovar, sem player de vídeo com pontos de ajuste, sem diálogos.
- Ordem: `scheduled_at` asc.

## 7. Detalhes técnicos

- Enum change: `ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'planning' BEFORE 'pending';` seguido de `ALTER TABLE public.posts ALTER COLUMN status SET DEFAULT 'planning';`. Postgres exige que `ALTER TYPE ... ADD VALUE` rode fora de transação — a ferramenta de migração lida com isso; se falhar, dividir em duas migrações.
- Rotina de limpeza de mídia (`cleanup-media`) atualmente ignora `pending`; ajustar para também ignorar `planning` (rascunho não deve ter mídia apagada por idade).
- Validação de `releasePostForApproval` roda no servidor com `supabaseAdmin` dentro do handler.
- Nenhuma mudança em RLS/GRANT — políticas atuais já cobrem admin (via `has_role`) e o cliente lê via token no servidor.

## Arquivos afetados

- migração Supabase (enum + default + cleanup)
- `src/lib/admin.functions.ts`
- `src/lib/client-portal.functions.ts` (apenas garantir que retorna `planning` também — provavelmente sem alteração)
- `src/components/talk/post-form.tsx`
- `src/routes/_authenticated/clients/$clientId/index.tsx`
- `src/routes/c/$token.tsx`
- `src/routes/api/public/hooks/cleanup-media.ts`

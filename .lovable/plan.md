## Talk — Sistema de Aprovação de Posts

Um sistema web com dois ambientes (admin da Talk e cliente) para revisar e aprovar posts de Instagram, com Supabase para auth, banco e storage de mídia.

### Identidade visual
- Fundo branco, tipografia limpa, estilo minimalista.
- Acentos: laranja (pendente/CTA), verde-chartreuse (aprovado), roxo (reprovado).
- Estrela de 8 pontas como detalhe sutil no header e em empty states.
- Design tokens em `src/styles.css` (oklch), variantes customizadas de shadcn.

### Backend (Lovable Cloud / Supabase)

**Tabelas**
- `clients`: id, name, instagram_handle, avatar_url, status ('active'|'inactive'), access_token (uuid único p/ link mágico), created_at.
- `posts`: id, client_id, type ('static'|'carousel'|'video'), cover_url (nullable exceto p/ vídeo), caption (text), scheduled_at (timestamptz), status ('pending'|'approved'|'rejected'), client_comment, responded_at, created_at, updated_at.
- `post_media`: id, post_id, url, position (int), kind ('image'|'video').
- `user_roles` + enum `app_role ('admin')` + função `has_role` (padrão Lovable).

**Storage buckets**
- `avatars` (público)
- `post-media` (público — feed do cliente carrega direto por URL)
- `post-covers` (público)

**RLS**
- `clients`, `posts`, `post_media`: admins (has_role) têm acesso total.
- Cliente NÃO usa auth Supabase. Acesso ao ambiente do cliente via `access_token` na URL; leituras/updates de aprovação passam por **server functions** que validam o token (não expõem RLS pública ampla). Policies restritas: leitura pública apenas via server function usando service role.

### Ambiente Admin (`/_authenticated/*`)
- Auth: email/senha via Lovable Cloud; primeiro usuário vira admin (seed manual ou auto-promote do primeiro cadastro).
- `/auth`: login.
- `/dashboard`: visão geral com dois modos (lista agrupada por cliente / calendário mensal). Filtros: cliente, tipo, status. Badges de status coloridos.
- `/clients`: CRUD de clientes (nome, @, avatar upload, ativo/inativo). Botão "Copiar link do cliente" (gera URL `/c/:token`).
- `/clients/:id`: detalhe do cliente + lista de posts + botão "Novo post".
- `/clients/:id/posts/new` e `/posts/:id/edit`:
  - Seletor de tipo (estático/carrossel/vídeo).
  - Upload de mídia (dropzone). Carrossel com reordenação drag-and-drop (dnd-kit).
  - Upload de capa (obrigatório se vídeo).
  - Legenda (textarea, preserva quebras/emojis).
  - Date/time picker para `scheduled_at`.
- Card de post exibe comentário de reprovação destacado em roxo. Editar → status volta a `pending`.

### Ambiente Cliente (`/c/:token`)
- Rota pública, sem login Supabase. Server function `getClientByToken` valida o token e retorna cliente + posts.
- Layout mobile-first estilo Instagram: header (avatar + @cliente + estrela decorativa), abas "Pendentes / Aprovados / Reprovados".
- Cards de post:
  - Estático: imagem única.
  - Carrossel: swipe (embla-carousel) + bolinhas.
  - Vídeo: `<video>` com `poster={cover_url}`.
  - Seção separada mostrando a **capa** do post e a **legenda** completa.
- Ações:
  - **Aprovar** → server function `approvePost({token, postId})` → toast: "Aprovado! Este post será publicado em DD/MM às HHh".
  - **Reprovar** → modal com textarea obrigatório "Deixe seu comentário" → `rejectPost({token, postId, comment})`.

### Regras de negócio
- Posts ordenados por `scheduled_at` ASC (mais próximos primeiro).
- Reprovado + editado no admin → `status='pending'`, `client_comment` preservado como histórico (mas card do cliente volta à aba Pendentes).
- Cliente só aprova/reprova; não edita mídia/legenda.
- Uploads: imagens JPG/PNG, vídeo MP4/MOV (validação no cliente + no server function).

### Stack técnica
- TanStack Start + Supabase (Lovable Cloud).
- Server functions para todas as operações de admin (com `requireSupabaseAuth` + `has_role`) e para operações do cliente por token (sem auth, validação por token).
- shadcn/ui, dnd-kit (reordenação), embla-carousel (swipe), date-fns.
- Design system em `src/styles.css`.

### Ordem de execução
1. Habilitar Lovable Cloud.
2. Migração: enum, tabelas, RLS, função `has_role`, buckets, policies de storage.
3. Design system + shell + auth admin.
4. CRUD de clientes + geração de link.
5. Cadastro/edição de posts (upload, reordenação, capa).
6. Dashboard (lista + calendário).
7. Ambiente do cliente (feed + aprovação).
8. Polimento mobile e estados vazios com a estrela.

### Perguntas rápidas antes de começar
1. **Primeiro admin**: quer que eu configure o primeiro cadastro para virar admin automaticamente, ou prefere que eu deixe apenas login (você me passa o email e eu promovo via migration)?
2. **Link do cliente**: token opaco na URL (`/c/abc123...`) é suficiente, ou quer também um código curto de 6 dígitos como alternativa?
3. **Notificações**: quando o cliente aprova/reprova, precisa disparar email para a equipe da Talk agora, ou fica só visível no dashboard?

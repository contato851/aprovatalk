## Objetivo

Trocar o navegador de pastas embutido no formulário de post por um **popup nativo do Google Picker** — a mesma interface visual do Drive, com miniaturas, busca e navegação já prontas do Google.

## Como vai funcionar

1. No formulário de post, os botões atuais do Drive viram um único botão: **"Escolher do Google Drive"**.
2. Ao clicar, abre o popup oficial do Google (Picker API) já filtrado na pasta **CLIENTES TALK!** — o usuário navega ali dentro (subpastas, busca, preview) exatamente como no Drive.
3. Pode selecionar **múltiplos arquivos** de uma vez (imagens/vídeos).
4. Ao confirmar, o popup fecha, o sistema recebe os IDs dos arquivos e importa cada um para o Storage do post (mesmo fluxo de importação atual em `src/lib/drive.functions.ts`).
5. Para escolher a **Capa** (Reels): botão separado "Escolher capa do Drive" que abre o mesmo picker mas aceita só 1 arquivo.

## Restrição de acesso

A restrição à pasta **CLIENTES TALK!** continua sendo aplicada **no servidor** na hora de importar (`assertInsideAllowedRoot` já existente). O Picker é configurado para abrir nessa pasta como raiz visual, mas mesmo que um usuário burle o filtro do lado cliente, o servidor recusa qualquer arquivo fora da hierarquia permitida.

## Detalhes técnicos

- **Picker API**: carregar `https://apis.google.com/js/api.js` sob demanda no formulário (dynamic import, só quando o botão é clicado) — sem quebrar SSR.
- **OAuth token para o Picker**: o Picker exige um `access_token` OAuth do usuário-dono (conta Talk). Solução: nova server function `getDrivePickerToken()` que devolve um access_token de curta duração obtido via connector Google Drive já linkado. Retorna só o token (sem refresh token).
- **Developer key / App ID**: precisamos de uma **Google API Key** e **App ID (Project Number)** do projeto Google Cloud da conta `contato@talk.net.br` para o Picker funcionar. Vou pedir esses valores e salvar como secrets (`GOOGLE_PICKER_API_KEY`, `GOOGLE_PICKER_APP_ID`).
- **View do Picker**: `DocsView` com `setParent("0AHPUmUsL6V9YUk9PVA")`, `setIncludeFolders(true)`, `setSelectFolderEnabled(false)`, `setMimeTypes("image/*,video/*")`, `setEnableDrives(true)`.
- **Importação**: reaproveita `importFromDrive` existente por fileId; roda em paralelo com feedback de progresso por arquivo.
- **Remoção**: sai o navegador de pastas de `post-form.tsx` (breadcrumbs, lista, botões por item); permanecem só os dois botões novos.

## Arquivos afetados

- `src/lib/drive.functions.ts` — adicionar `getDrivePickerToken()`; manter `importFromDrive` e `assertInsideAllowedRoot`; remover `browseDrive` (não usado mais).
- `src/components/talk/post-form.tsx` — remover UI do navegador interno; adicionar botões que abrem o Picker e recebem seleção.
- Novo helper `src/lib/google-picker.ts` — carrega `gapi` sob demanda e abre o Picker.

## Pré-requisitos que preciso de você

1. **Google API Key** (Cloud Console → APIs & Services → Credentials → API Key, com "Picker API" habilitada no projeto).
2. **App ID** (o "Project number" do mesmo projeto Google Cloud).

Se preferir, posso te guiar passo a passo pra gerar. Confirma que quer seguir por esse caminho (Picker em popup) e me passa esses dois valores?

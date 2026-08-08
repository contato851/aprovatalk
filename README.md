# Talk Approval Hub

Prompt para o Lovable — Sistema de Aprovação de Posts da Talk

Copie e cole o texto abaixo no Lovable:

Crie um sistema web de aprovação de posts para uma consultoria de posicionamento digital chamada Talk. O sistema tem dois ambientes distintos: o ambiente da Talk (equipe interna) e o ambiente do cliente (aprovação de conteúdo). Use Supabase para autenticação, banco de dados e armazenamento de arquivos (imagens e vídeos).

Identidade visual

Fundo claro. cor predominante: branco

Cores de destaque: laranja, verde-chartreuse e roxo

Estilo moderno e minimalista, com tipografia limpa

Elemento gráfico da marca: estrela de oito pontas (pode aparecer como detalhe sutil no header e em estados vazios)

Estrutura de dados

Clientes

Nome, @ do Instagram, foto de perfil (avatar), status (ativo/inativo)

Posts (vinculados a um cliente)

Tipo: estático, carrossel ou vídeo

Mídia: uma imagem (estático), múltiplas imagens ordenadas (carrossel) ou um arquivo de vídeo (vídeo/reel)

Capa do post (imagem separada, obrigatória para vídeos e opcional para os demais)

Legenda (texto longo, com suporte a quebras de linha e emojis)

Data e hora programadas de publicação

Status: pendente, aprovado ou reprovado

Comentário do cliente (preenchido quando o post é reprovado)

Data da resposta do cliente

Ambiente da Talk (admin)

Acesso por login e senha (equipe da Talk).

Dashboard geral: visão de todos os posts organizados por cliente e por data. Incluir dois modos de visualização: lista agrupada por cliente e calendário mensal. Filtros por cliente, tipo de post e status. Indicadores visuais de status (pendente em laranja, aprovado em verde, reprovado em roxo/vermelho).

Cadastro de clientes: criar, editar e desativar clientes, com upload do avatar.

Página do cliente (visão interna): dentro de cada cliente, listar seus posts ordenados por data e permitir cadastrar novos materiais:

Estático: upload de 1 imagem

Carrossel: upload de múltiplas imagens com reordenação por arrastar

Vídeo: upload de vídeo + upload da capa

Em todos: campo de legenda e data/hora programada de publicação

Acompanhamento: quando o cliente reprova um post, o comentário dele aparece destacado no card do post no admin. Permitir editar o post e reenviá-lo para aprovação (status volta para pendente).

Link de acesso do cliente: cada cliente tem um link exclusivo de acesso ao seu ambiente de aprovação (autenticação simples por link mágico ou código, sem exigir cadastro complexo).

Ambiente do cliente (aprovação)

O cliente acessa pelo link exclusivo e vê apenas os posts dele.

Feed estilo Instagram: a tela emula o feed do Instagram — header com avatar e @ do cliente, e os posts pendentes exibidos em cards no formato do Instagram:

Estático: imagem única

Carrossel: navegação por swipe/setas com indicador de bolinhas

Vídeo: player com a capa como thumbnail

Cada card exibe, em áreas separadas e claramente identificadas: o post (mídia), a capa do post e a legenda completa.

Ações de aprovação:

Botão Aprovar: ao aprovar, exibir mensagem de confirmação com a data e hora em que o post será publicado (ex.: "Aprovado! Este post será publicado em 22/07 às 18h").

Botão Reprovar: ao reprovar, abrir um campo de texto com o título "Deixe seu comentário", obrigatório para concluir a reprovação.

Abas ou filtro simples: pendentes, aprovados e reprovados, para o cliente consultar o histórico.

Layout responsivo com prioridade para mobile, já que o cliente provavelmente vai aprovar pelo celular.

Regras de negócio

Posts ficam ordenados por data programada (mais próximos primeiro).

Um post reprovado e depois editado pela Talk volta ao status pendente e reaparece no feed do cliente.

O cliente não pode editar mídia nem legenda — apenas aprovar ou reprovar com comentário.

Uploads de vídeo devem aceitar arquivos MP4/MOV; imagens em JPG/PNG.

Comece criando a estrutura do banco no Supabase, depois o ambiente admin e por fim o ambiente do cliente.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://aprovatalk.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/88145799-9803-4a17-9c69-fe0fddd1ed14).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

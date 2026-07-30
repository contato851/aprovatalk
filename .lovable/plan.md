## Objetivo
Cadastrar a cliente **Joy Nunes** (@jojoynunes) com a foto enviada.

## Passos
1. Preparar a foto: recortar em quadrado (centralizado) e redimensionar para uso como avatar (JPEG otimizado).
2. Enviar a imagem para o armazenamento privado de avatares do projeto (bucket `avatars`), gerando um caminho único.
3. Criar o registro da cliente na tabela de clientes com:
   - Nome: Joy Nunes
   - Instagram: jojoynunes
   - Foto: caminho do avatar enviado
   - Status: ativa
   - Token de acesso do portal gerado automaticamente
4. Verificar na tela de Clientes que o card da Joy Nunes aparece com a foto e o link do cliente funcionando.

## Observações técnicas
- Nenhuma alteração de código é necessária: apenas upload no bucket `avatars` e um INSERT em `public.clients`.
- O avatar é servido por URL assinada, já implementado em `listClients`.

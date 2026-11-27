# UX-07 · Consistência visual

Base `2e2b4fe`. Os comparativos mostram páginas inteiras no Chromium, com a mesma instituição e o mesmo estudante fictícios antes e depois. As larguras são 1440 px no desktop e 390 px no celular.

| Tela | Antes | Depois |
| --- | --- | --- |
| Entrada | [1440 px](before-login-1440.jpg) · [390 px](before-login-390.jpg) | [1440 px](after-login-1440.jpg) · [390 px](after-login-390.jpg) |
| Cadastro | [1440 px](before-register-1440.jpg) · [390 px](before-register-390.jpg) | [1440 px](after-register-1440.jpg) · [390 px](after-register-390.jpg) |
| Perfil e navegação | [1440 px](before-profile-1440.jpg) · [390 px](before-profile-390.jpg) | [1440 px](after-profile-1440.jpg) · [390 px](after-profile-390.jpg) |
| Doação com ponto de entrega escolhido | [1440 px](before-donate-1440.jpg) · [390 px](before-donate-390.jpg) | [1440 px](after-donate-1440.jpg) · [390 px](after-donate-390.jpg) |

## Critérios e decisões

- **Navegação.** A barra da conta ocupava duas linhas no celular. Quatro links curtos agora cabem em uma linha a 320 e 390 px. O estudante continua vendo todos os destinos e o sublinhado da rota atual. Em uma falha do histórico, o link Acervo permanece no cabeçalho e no rodapé. O convite junto à explicação permanece exclusivo do histórico vazio.
- **Acesso.** A composição com a ilustração original já funciona no desktop. No formulário, os rótulos agora identificam exclusivamente seus campos, o botão de senha tem alvo de 44 px e o aviso de privacidade está associado ao consentimento. A divergência entre senhas tem texto junto ao campo.
- **Perfil.** O nome continua editável na coluna principal. E-mail, tipo de conta e encerramento da sessão ficam juntos em papel claro. A região de atualização distingue o envio da confirmação.
- **Doação.** O seletor nativo de arquivo recebe uma superfície em português com foco visível, prévia e nome do arquivo. A divisão entre descrição e entrega destaca a instituição selecionada e seu endereço antes do envio.
- **Metadados.** A rota ausente podia herdar o título da página anterior. Páginas de erro têm título e cabeçalho principal próprios. O teste de saída da prévia verifica a remoção de noindex e o título da página de destino.

## Interfaces preservadas

A Home pública, a prévia cinematográfica, o acervo, a estante, o detalhe, os comprovantes e os históricos mantêm a composição aprovada. O rodapé já expõe os destinos públicos e identifica a demonstração. Nos painéis de equipe e administração, recebimento, estoque, retirada, filtros, paginação e confirmação já têm controles próximos dos respectivos registros. A revisão preservou a densidade e as ações do SH-03. O estado de instituição ausente usa o mesmo tratamento de página indisponível. [Evidência anterior do SH-03](../sh-03/HANDOFF.md).

## Verificação local

- Typecheck e build de produção passaram. Os 44 testes unitários passaram.
- A suíte Playwright completa passou no Chrome instalado com `PLAYWRIGHT_CHANNEL=chrome`, 109/109. Inclui as operações dos quatro perfis, os controles do filme e da estante, as confirmações, o retorno de foco e a recuperação de erros.
- A matriz administrativa avaliou oito rotas a 320, 390, 768 e 1440 px com axe e checagem de overflow. Quatro verificações adicionais de captura cobriram entrada, cadastro, perfil e doação nas mesmas larguras, com movimento reduzido, axe e medição da largura do documento.
- Na primeira execução completa com Chromium, 107 de 109 passaram. O teste do filme a 1440 px atingiu o limite de espera pelo início da reprodução. A expectativa antiga do teste de metadados também detectou o novo título da página ausente e foi atualizada para verificar esse título e a remoção de noindex. A suíte final no Chrome passou integralmente.

## Ferramentas e limites

Aplicadas as skills repassa-context, repassa-context-efficiency, repassa-design, repassa-motion, repassa-browser-qa, repassa-implement, repassa-verification e repassa-review. Taste orientou tipografia e composição. Impeccable orientou a crítica das telas existentes, UI UX Pro Max a revisão de campos e alvos de toque, Emil a decisão de conservar o movimento existente e Cantos Apple a revisão das superfícies aninhadas. Usados Graphify local (AST), RTK, prévia do navegador e Playwright.

Os testes exercitam o frontend contra respostas sintéticas de API e em modo demonstrativo. A validação integrada de release, o uso de um gerenciador de senhas instalado, testes com leitor de tela físico e aparelhos reais ficam fora desta rodada. A revisão do PR pelo responsável precede a decisão sobre a rota inicial. Para desfazer o refinamento, reverter o PR, sem migração de dados.

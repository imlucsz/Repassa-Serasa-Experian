# SH-03 · Refinamento da administração

Branch `feat/UX-SH-03-admin-refinement`, a partir de `16851d3`.

## Três mudanças

1. **Fila de aprovação em primeiro plano.** O painel reúne contagem, nomes e acesso à fila. Os quatro indicadores de acompanhamento ocupam duas linhas completas no celular, inclusive quando a fila está vazia.
2. **Navegação e hierarquia editorial.** As seis seções têm ícones e rótulos visíveis, com destaque para o destino atual. Os títulos usam Newsreader e as ações e os dados usam DM Sans. O cadastro institucional aproxima a orientação inicial dos três campos e da ação de envio.
3. **Leitura de registros e tomada de decisão.** Instituições, membros, usuários, materiais, reservas e auditoria compartilham o tratamento de tabelas e filtros. No celular, cada registro começa pelo nome, seguido dos valores com rótulos. Resultados vazios permitem limpar filtros aplicados. Confirmações em linha recebem foco, aceitam Escape e devolvem o foco ao controle de origem ao cancelar. A preferência por movimento reduzido desativa a animação de confirmação.

## Evidência

Chrome local, API interceptada com dados sintéticos. Foram verificadas as sete rotas administrativas e `/instituicoes/nova` a 390 e 1440 px.

| Verificação | Resultado |
| --- | --- |
| `npm run lint` e `npm run build` | TypeScript e build aprovados |
| `npm run test:ci` | 40 de 40 |
| Playwright · `admin.spec.mjs` e `admin-a11y.spec.mjs` | 25 de 25, incluindo 16 verificações axe de telas carregadas, sem violações detectadas nem transbordamento horizontal |
| Teclado e movimento reduzido | Confirmar alcançável por Tab, Escape fecha a confirmação e restaura o foco. A animação fica desativada. |

Para repetir em ambiente livre, use `PLAYWRIGHT_CHANNEL=chrome npm run test:browser -- --project=api admin.spec.mjs admin-a11y.spec.mjs`. Nesta sessão a porta 4272 estava ocupada. A execução usou uma configuração local temporária com Vite na 4289. A primeira rodada identificou seletores antigos de confirmação e uma fixture que ignorava filtros de situação. Os testes finais incluem as correções e esperam pelos dados antes de executar axe.

| Tela | Antes · UX-05 | Depois · SH-03 |
| --- | --- | --- |
| Painel em desktop | [1440 px](../ux-05/admin-dashboard-1440.png) | [1440 px](dashboard-1440.png) |
| Painel em celular | [390 px](../ux-05/admin-dashboard-390.png) | [390 px](dashboard-390.png) |
| Fila e aprovação | [Fila em desktop](../ux-05/admin-instituicoes-1440.png) | [Confirmação em celular](confirmacao-390.png) |
| Cadastro institucional | [1440 px](../ux-05/cadastro-instituicao-1440.png) | [1440 px](cadastro-1440.png) |

As referências visuais vieram das exportações em `figma-reference/` e dos handoffs UX-04/UX-05. O acesso direto ao Figma e ao site de referência via ferramenta de navegação estava indisponível.

## Revisão e continuidade

- Interface em `src/ui/PrivateArea.tsx` e `src/pages/{Admin,AdminInstitutions,AdminUsers,AdminViews,RegisterInstitution,adminShared}.tsx`, com estilos em `src/pages/admin.css`. Regressões em `tests/browser/{admin,admin-a11y}.spec.mjs`.
- Uma consulta genérica de acessibilidade ao Groq `openai/gpt-oss-120b` pelo repassa-orchestrator, perfil `free-only`. 168 tokens de entrada, 550 de saída e US$ 0 registrados. O retorno parcial orientou os testes de foco. A inspeção das telas foi local.
- Próxima oportunidade de design: permitir consultar os identificadores completos da auditoria com teclado e toque. A validação manual com leitor de tela continua pendente.
- SH-02 e a validação integrada seguem com Devin. Para reverter o refinamento, reverta o commit do PR. Sem migração.

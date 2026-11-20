# RePassa

Plataforma de reuso de materiais educativos. A instituição recebe a doação, confere o material e serve como ponto de retirada para o próximo estudante.

## Frontend

Use Node.js 22.12 ou superior. Na raiz do repositório, execute `npm ci` e `npm run dev`. Abra o endereço indicado pelo Vite.

O modo padrão consulta a API na mesma origem em `/api/v1`. Encaminhe esse caminho ao backend no ambiente de integração e configure o servidor para servir `index.html` nas rotas do aplicativo. Os projetos de backend e vídeo têm dependências e configurações próprias.

Para usar instituições e materiais fictícios, defina `VITE_DATA_MODE=mock` antes de iniciar o Vite ou executar `npm run build`. A interface exibe um aviso de demonstração. Sem esse valor, o frontend consulta a API, inclusive em caso de erro.

### Demonstração na Vercel Hobby

Importe o repositório com diretório raiz `.` e Node.js `22.x`. O `vercel.json` configura Vite, instalação com `npm ci`, compilação com `npm run build`, saída `dist` e reescrita de `/(.*)` para `/index.html`. Configure `VITE_DATA_MODE=mock` no ambiente Production da demonstração e também em Preview se quiser validar PRs com dados fictícios. Alterações nessa variável exigem uma nova compilação.

| Rota pública | Uso |
| --- | --- |
| `/` | Apresentação e etapas da doação e retirada |
| `/catalogo` | Busca, filtros, paginação e alternância entre estante e grade |
| `/materiais/:id` | Dados do material e ponto de retirada |

A estante aceita arraste horizontal, setas do teclado e controles visíveis. A grade é a visualização inicial em telas pequenas e com preferência por movimento reduzido.

## Verificação

Execute `npm run test:ci`, `npm run lint` e `npm run build` na raiz. A estante e o adaptador têm testes com quantidades variáveis de materiais e respostas de erro. O contrato da API e os critérios dos próximos fluxos estão no [Agent Kit](docs/repassa/INDEX.md).

O logotipo utiliza o recorte da prancha oficial descrito no projeto promocional. A gravura da abertura foi criada para o RePassa com ImageGen. As capas demonstrativas são composições originais do frontend.

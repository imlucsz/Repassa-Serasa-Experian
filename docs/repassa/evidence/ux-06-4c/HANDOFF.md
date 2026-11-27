# UX-06.4c · O próximo leitor

Prévia em `/preview/home-cinematica`. Base aprovada em `83d592c` (PR #32), implementação do polimento em `59e6f62`, branch `feat/UX-06-4-cinematic-polish`. Aprovação visual pelo proprietário é a próxima decisão.

## Direção e comparação

A capa, a entrada do livro e da ficha, o curta, os quatro carimbos e a chamada final vêm da V2 aprovada. Na capa, a borda superior da gravura agora se dissolve no papel e um filete acompanha a dobradiça da lombada. As ações continuam disponíveis durante a entrada. O detector Impeccable apontou o filete como possível acento lateral de cartão. A inspeção das capturas mostrou que ele acompanha a encadernação do livro e foi mantido.

Na ficha móvel anterior, três retângulos vazios depois do primeiro carimbo davam pouca indicação do que viria a seguir. Cada coluna agora nomeia a etapa, oferece uma linha para o próximo carimbo e destaca o estágio atual. Mantive o ritmo de rolagem e a margem anotada da V2. Os carimbos acompanham o leitor nos dois sentidos.

| Captura | V2 aprovada | Polimento |
|---|---|---|
| Desktop 1440 × 900 | [Abertura](../ux-06-4-v2/desktop.png) | [Abertura](desktop.png) · [Página inteira](desktop-full.png) |
| Mobile 390 × 844 | [Abertura](../ux-06-4-v2/mobile.png) | [Abertura](mobile.png) · [Página inteira](mobile-full.png) |
| Ficha móvel na entrega | [Antes](before-record-390.png) | [Depois](after-record-390.png) |
| Ficha desktop na entrega | [Antes](before-record-1440.png) | [Depois](after-record-1440.png) |
| Capítulos | [Filme anterior](../ux-06-4-v2/film.png) | [Filme](film.png) · [Ficha na reserva](registro.png) |

A gravação local `Documents/RePassa-UX-06-4-review/final/visita-home-polish.mp4` percorre a abertura, o curta inteiro, a ficha e o fechamento. São 37,96 s em 1440 × 900, H.264 a 25 fps, com áudio do master sincronizado ao início observado da reprodução e codificado em AAC estéreo. A política do repositório mantém exportações audiovisuais fora do histórico Git.

## Filme, acesso e navegação

O primeiro clique reutiliza o pôster no elemento de vídeo e apresenta o estado de carregamento. O player conserva controles nativos. Uma falha retorna o foco de teclado ao botão de nova tentativa quando o player estava focado. O visitante também pode seguir pelo link para o Shorts autorizado. A recuperação foi exercitada bloqueando o MP4 e liberando a requisição antes da segunda tentativa. O destino do link foi conferido. A disponibilidade do YouTube depende do serviço externo.

A prévia deixava seu título em uma página de rota ausente após navegação dentro do aplicativo. O caso foi reproduzido nas duas larguras. A desmontagem agora restaura o título anterior e remove o `noindex` da prévia. Um teste cobre a navegação para a rota sem título próprio.

## Verificação executada

Windows, Chrome via Playwright, conteúdo público em modo mock explícito. O build de produção Vite foi servido localmente com `vite preview`. Sessões limpas, sem simulação de rede lenta.

- `npm run lint` e `npm run build` passaram. `npm run test:ci` passou em 44/44 testes.
- `playwright test cinematic-home --project demo` com `PLAYWRIGHT_CHANNEL=chrome` passou em 14/14. Cobertura de teclado, redução de movimento, foco, recuperação, metadados, não transbordamento, reserva de espaço, sequência dos carimbos, rota oficial e mídia sob demanda.
- Axe com regras WCAG 2/2.1 A e AA encontrou zero violações sérias ou críticas nas duas larguras durante o teste da página. O teste de ociosidade observou zero chamadas rAF no intervalo de um segundo após a entrada.
- No build, o Chrome abriu o filme com Enter no desktop e toque emulado no mobile. Zero requisições de mídia antes da ativação. O asset com hash respondeu HTTP 206. Pausa por espaço, volume de 1 para 0,95 por seta para baixo, entrada nativa em tela cheia por clique duplo e saída da tela cheia foram verificados. As sete legendas pt-BR chegaram ao player. A revisão da V2 usou a locução isolada localmente, os sete tempos do master e os quadros originais.
- Master e MP4 do build têm SHA-256 idêntico, `1c414831b81fb1427b2bebe1febdf957609c191c3f5ded26463b86d48f471771`. O arquivo tem 22 s em 1080 × 1920. Chunk da rota em gzip mediu 3,68 kB de JS e 4,40 kB de CSS.
- Uma observação local da abertura com PerformanceObserver mediu LCP de 340 ms e CLS de 0,00375 em desktop, e 144 ms e 0,00824 no viewport móvel. São amostras de laboratório no mesmo computador. Safari/iOS e aparelho físico não foram exercitados.
- Verificação do índice pelo guard e `git diff --cached --check` a cada checkpoint.

## Ferramentas e continuidade

Skills aplicadas na implementação e no polimento: repassa-context, repassa-context-efficiency, repassa-implement, repassa-verification, repassa-design, repassa-motion, repassa-browser-qa, repassa-review, Taste, Impeccable, UI UX Pro Max, Emil Design Engineering, Choreograph e Cantos Apple. Crítica e julgamento visual feitos no próprio chat. Graphify local em modo AST, RTK, browser integrado e Playwright. O consumo individual de tokens não foi medido.

Para repetir, use Node e dependências do lockfile, `VITE_DATA_MODE=mock npm run build` e `npm run preview`. Abra a rota da prévia. O experimento não exige alteração de contrato, banco, migração ou configuração de serviço. Para retornar ao desenho aprovado, use a revisão `83d592c` em uma cópia separada. A gravação anterior e os arquivos locais de trabalho foram preservados.

# UX-06.3 · Reservas e doações do estudante

Base `c107eec`. Capturas locais do Chromium em 1440 × 900 e 390 × 844, com dados fictícios e respostas de API interceptadas pelo Playwright. As imagens incluem a página inteira. O código permaneceu oculto em todas as capturas.

| Estado | Antes, desktop / celular | Depois, desktop / celular |
| --- | --- | --- |
| Primeira reserva | [1440 px](before-empty-1440.jpg) · [390 px](before-empty-390.jpg) | [1440 px](after-empty-1440.jpg) · [390 px](after-empty-390.jpg) |
| Aguardando retirada | [1440 px](before-active-1440.jpg) · [390 px](before-active-390.jpg) | [1440 px](after-active-1440.jpg) · [390 px](after-active-390.jpg) |
| Prazo encerrado | [1440 px](before-expired-1440.jpg) · [390 px](before-expired-390.jpg) | [1440 px](after-expired-1440.jpg) · [390 px](after-expired-390.jpg) |
| Falha de leitura | [1440 px](before-failed-1440.jpg) · [390 px](before-failed-390.jpg) | [1440 px](after-failed-1440.jpg) · [390 px](after-failed-390.jpg) |
| Comprovante de doação | [1440 px](before-receipt-1440.jpg) · [390 px](before-receipt-390.jpg) | [1440 px](after-receipt-1440.jpg) · [390 px](after-receipt-390.jpg) |
| Reserva confirmada após consulta ao histórico | — | [1440 px](after-confirmed-1440.jpg) · [390 px](after-confirmed-390.jpg) |

## Decisões

A ficha pautada acompanha a primeira reserva e liga a explicação diretamente ao acervo. A reserva ativa reúne prazo, fuso horário e ações privadas numa ficha com borda destacada. Depois da primeira revisão no celular, o acesso ao acervo passou para depois da lista para antecipar as informações de retirada. O comprovante de doação usa um único cabeçalho de confirmação e destaca o material e o ponto de entrega retornados pela API. O tratamento é estático, inclusive com movimento reduzido.

## Verificação local

- `npm run lint` e `npm run build` passaram.
- `npm run test:ci` passou nos 44 testes.
- `npm run test:browser -- my-reservations.spec.mjs donations.spec.mjs api.spec.mjs demo.spec.mjs --reporter=line` passou nos 42 testes. Reservas e doações verificadas com axe e checagem de largura a 320, 390, 768 e 1440 px.
- A cobertura inclui falha no upload, cadastro incerto, leitura após perda de resposta, prevenção de reenvio, foco ao cancelar, paginação, revalidação, cópia e expiração. O teste de visibilidade simula os eventos do documento no Chromium.
- Uma primeira execução identificou um import de ícone ausente no formulário. Após a correção, as seis rotinas de captura final passaram e os testes de doação repetiram o fluxo completo.

A evidência cobre o frontend com fixtures e o modo demonstrativo explícito. Persistência, banco, clipboard em dispositivos físicos e leitores de tela reais ficam fora desta rodada. A revisão visual e a aprovação de merge cabem ao responsável pelo projeto. Para rollback, reverter o commit de UX-06.3.

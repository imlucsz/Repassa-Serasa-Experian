# Validação final — 17/11/2026

- `npm.cmd run typecheck`: passou após os últimos ajustes.
- `npm.cmd run compositions`: RePassaPromo, 1080×1920, 30 fps, 660 frames.
- `npm.cmd run render:final`: terminou com código 0, H.264 CRF 16, cerca de 4,8 MB.
- `node scripts/validate-render.cjs`: passou em resolução, fps, duração exata
  de 22 s e contagem de 660 frames decodificados. Decodificação integral sem erros.
- Revisão visual: frames 40, 155, 245, 340, 450, 550, 640, 659;
  mais 18 frames nas proximidades das transições. Painéis em `out/validation/`.
- Reprodução real em Chromium via localhost: `ended=true`, `currentTime=22`,
  `duration=22`, `totalVideoFrames=660`, `droppedVideoFrames=0`, `error=null`.
- Revisão independente do código: nenhuma falha bloqueante de duração,
  determinismo, sequência ou uso de assets. Ponte 89→90 conferida visualmente.
- Ajustes após o primeiro render: espaço entre livro e campo de título,
  saída do primeiro headline, confirmação exibida somente após reserva.
- Hashes dos manifests da raiz idênticos aos anteriores; frontend não alterado.
  Exclusões preexistentes em `assets/` foram preservadas. Sem commit/push.

## Limitações e próximos refinamentos

Master visual sem áudio; não foram fornecidas trilha ou locução licenciadas.
A logo oficial está na prancha JPG e é mostrada por recorte, sem redesenho;
um SVG/PNG transparente oficial permitirá maior nitidez e fundo uniforme.
Interfaces demonstrativas, código ilustrativo e instituição sem nome real.
O resultado não representa integração funcional com o app nem parcerias reais.

# RePassa — filme promocional

**Versão com áudio:** `out/repassa-promo-audio-final.mp4`, gerada por
`npm.cmd run render:audio`. Usa as sete vozes e a trilha fornecidas.
Detalhes de sincronização, mixagem e validação em [docs/audio-mastering.md](docs/audio-mastering.md).
A composição `RePassaPromoAudio` permite prévia com o master no Studio.
O texto abaixo documenta a versão visual silenciosa, mantida intacta.

Projeto independente de Remotion, React e TypeScript. Master visual de 22 s,
1080 × 1920, 30 fps, 660 frames, MP4 H.264/yuv420p, CRF 16. Sem trilha ou locução.
Nenhum recurso do frontend principal é importado.

```powershell
cd C:\Users\Aluno\Documents\Repassa-Serasa-Experian\video\repassa-promo
npm.cmd ci
npm.cmd run studio
npm.cmd run typecheck
npm.cmd run compositions
npm.cmd run render:final
```

Saída: `out/repassa-promo-final.mp4`. O script `render:test` continua exportando
os primeiros 90 frames em `out/repassa-intro-test.mp4`.

## Timeline

| Frames (inclusivos) | Tempo | Conteúdo |
|---|---|---|
| 0–89 | 0–3 s | Abertura aprovada: “Tem um livro parado aí?” |
| 90–179 | 3–6 s | Livro passa a integrar a experiência digital |
| 180–269 | 6–9 s | Cadastro do material e publicação da doação |
| 270–359 | 9–12 s | Depósito e confirmação “Material recebido” |
| 360–479 | 12–16 s | Catálogo em estante, categorias e seleção |
| 480–569 | 16–19 s | Reserva, código ilustrativo e retirada |
| 570–659 | 19–22 s | Logo oficial e “Conhecimento merece circular.” |

`DigitalScene` mantém a mesma interface durante oportunidade/doação. As demais
mudanças de cena são cobertas por wipes de 16 frames. A abertura preserva a
composição e animação originais; sua saída verde fica em tela para conectar à UI.

## Arquitetura e assets

- `src/components/Motion.tsx`: tipografia, easing, painéis, botões, confirmação,
  instituição ilustrativa, transições e recorte da logo oficial.
- `src/components/Book.tsx`: livro original reutilizado e capas vetoriais de apoio.
- `src/scenes/`: abertura e cenas narrativas, sem estado ou relógio externo.
- `public/brand/RePassa.jpg`: prancha oficial, usada sem alteração do original.
- `public/illustrations/RePassa.jpg`: ilustração oficial usada na retirada.
- `docs/motion-analysis.md`: análise das quatro referências e decisões de direção.

O nome em texto na abertura foi preservado conforme aprovado. No encerramento,
a logo vem diretamente de um viewport da prancha, sem redesenho. Uma futura
logo SVG/PNG transparente melhora a nitidez e elimina o fundo raster da prancha.
Materiais, instituição sem nome e código `RP-2048` são demonstrações visuais,
não dados de produção nem afirmações de parceria.

## Verificação reproduzível

Os scripts de inspeção requerem `ffmpeg` e `ffprobe` completos no PATH. A versão
reduzida fornecida pelo Remotion não inclui `pad`, `tile` ou `select`.

```powershell
node scripts/inspect-references.cjs
node scripts/inspect-references.cjs --transitions
node scripts/validate-render.cjs
node scripts/preview-render.cjs
```

Prévia do MP4: `http://127.0.0.1:3130`. O servidor fica restrito a localhost e
serve apenas a página e o MP4. Encerre com Ctrl+C.

`validate-render` confere resolução, fps, codec, duração e os 660 frames
decodificados; também decodifica todo o MP4 e extrai 8 frames narrativos e 18
momentos nas transições. Relatório: `out/validation/report.json`.
Painéis: `out/validation/scene-sheet.png` e `boundary-sheet.png`.
Arquivos de análise e renders em `out/` são ignorados pelo Git.

Sem dependências adicionais, fontes remotas, áudio das referências ou Three.js.
Todos os pacotes Remotion permanecem em 4.0.544. Não houve commit ou push.

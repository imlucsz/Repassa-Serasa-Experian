# Master com narração e trilha — 17/11/2026

Entrega: `out/repassa-promo-audio-final.mp4`.
Original silencioso: `out/repassa-promo-final.mp4`, preservado byte a byte.
O fluxo H.264 foi copiado, não recodificado. Hashes em
`out/audio/mastering-report.json` comprovam imagem idêntica.

## Inspeção das fontes

Todos os oito MP3 fornecidos existem. Vozes mono, trilha estéreo, todos 44,1 kHz.
FFprobe e FFmpeg mediram durações, loudness, true peak e silêncios abaixo de
−45 dB por ao menos 60 ms. Relatório completo: `out/audio/inspection.json`.

| Arquivo | Duração fonte | Trecho conservado | Entrada no filme | Fim |
|---|---:|---:|---:|---:|
| voz-01.mp3 | 1,724063 s | 0,03–1,69 s | 0,27 s | 1,93 s |
| voz-02.mp3 | 2,037500 s | 0,13–1,99 s | 3,22 s | 5,08 s |
| voz-03.mp3 | 1,959125 s | 0–1,80 s | 6,25 s | 8,05 s |
| voz-04.mp3 | 2,586063 s | 0,01–2,39 s | 9,20 s | 11,58 s |
| voz-05.mp3 | 1,959125 s | 0,01–1,81 s | 12,35 s | 14,15 s |
| voz-06.mp3 | 2,925688 s | 0–2,76 s | 15,50 s | 18,26 s |
| voz-07.mp3 | 3,631000 s | 0,07–3,61 s | 18,40 s | 21,94 s |
| trilha.mp3 | 101,015500 s | 0–22 s | 0 s | 22 s |

Só foram removidos silêncios nas extremidades, preservando margens de pelo menos
50 ms junto à fala detectada. Pausa interna de ~376 ms na voz 7 mantida.
Não há time-stretch, alteração de pitch ou aceleração. Voz 6 antecipa a próxima
ação em 0,50 s sobre a seleção no catálogo; voz 7 antecipa a marca em 0,60 s.
Entre os arquivos 6 e 7 ficam 140 ms, além dos silêncios conservados.

## Mixagem

- Ganho fixo por voz, medido no trecho conservado, referência −20 LUFS mono.
  Isso corrige a diferença original de mais de 12 LU entre as gravações sem
  alterar a prosódia ou comprimir cada palavra.
- Vozes centralizadas, música estéreo. Sessão e master a 48 kHz.
- Música a −28 LUFS antes da soma; redução adicional de 7 dB sob cada fala,
  ataque antecipado de 160 ms e recuperação de 380 ms. Pausas internas não
  fazem a trilha subir. Fade de entrada 550 ms; saída musical 900 ms.
- Master em duas passagens: alvo −16 LUFS / teto −1,5 dBTP. WAV PCM 24 bits
  em `public/audio/master/repassa-master.wav`; AAC-LC 320 kb/s no MP4.
- Resultado medido **após codificação AAC**: −15,73 LUFS, −1,52 dBTP,
  LRA 2,10 LU. A trilha original tinha true peak de +0,74 dBTP; foi atenuada.

## Reprodução e integração

`RePassaPromo` continua silenciosa. `RePassaPromoAudio` reutiliza exatamente a
mesma animação e carrega o master local com `Audio` e `staticFile` no Remotion.
Gere o master antes de abrir essa composição em uma instalação nova.

```powershell
npm.cmd run audio:inspect
npm.cmd run render:audio
npm.cmd run typecheck
npm.cmd run compositions
node scripts/preview-render.cjs --audio
```

Prévia em `http://127.0.0.1:3131`. O processo de mastering é reproduzível e não
altera os MP3 originais. Requer FFmpeg/FFprobe completos no PATH.

## Validação

- TypeScript aprovado; ambas as composições reconhecidas com 660 frames.
- MP4: 1080×1920, 30 fps, 22 s, H.264; áudio AAC estéreo 48 kHz, 22 s.
- Decodificação integral sem erro; nenhum diálogo sobreposto; último clip
  termina em 21,94 s sem corte da frase.
- Chromium reproduziu até 22 s com áudio habilitado e decodificado,
  660 frames, zero descartes e nenhum erro do elemento de vídeo.
- Nenhuma ferramenta disponível ofereceu escuta perceptiva do áudio ao agente.
  A validação foi por medições, temporização e reprodução técnica; não equivale
  a uma avaliação auditiva humana da dicção ou da relação emocional música/voz.
- Nenhuma cena, tipografia, câmera, transição, ilustração ou frontend alterado.

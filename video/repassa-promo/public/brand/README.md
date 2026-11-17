# Logo oficial

`RePassa.jpg` é a prancha fornecida. `OfficialLogo` em
`src/components/Motion.tsx` mostra o lockup horizontal por um viewport de
590×145 px, origem (70,207) na prancha 1408×768. A imagem original é preservada.
Não foi desenhado outro símbolo ou wordmark para o encerramento.

O nome em texto na abertura permanece como aprovado. A propriedade opcional
`logoPath` em `Root.tsx` permite trocar esse elemento por uma versão adequada
ao fundo verde quando fornecida (exemplo: `brand/repassa-logo-clara.svg`).
O caminho é relativo a `public/`; `Img` e `staticFile` aguardam o asset no render.

Para melhorar o master, prefira uma futura exportação oficial SVG ou PNG
transparente à prancha raster. Não sobrescreva a prancha original.

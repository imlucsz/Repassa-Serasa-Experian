# RePassa — direção de movimento

Análise de 17/11/2026. Fontes locais em `references/`; metadados e 128 frames
extraídos via FFprobe/FFmpeg em `out/reference-analysis/`. Cada vídeo foi lido
em 16 momentos distribuídos e em 16 frames sucessivos com intervalos de 120 ms
em uma transformação importante. Leitura temporal por sequências de frames;
não se inferiu sincronização musical a partir das imagens.

| Referência | Evidência e princípio adaptado |
|---|---|
| ifood exemple, 21,407 s, 576×1024, 30 fps | Filmagem de um monitor, não export limpo. UI em lista cresce para celular inclinado entre 5,5–7,3 s; grandes palavras e produto têm protagonismo alternado. Adotar deslocamento de câmera aparente e contraste de escala; evitar mão 3D e cortes frenéticos. |
| amazon exemple, 29,103 s, 360×640, 29,97 fps | Conteúdo horizontal dentro de vídeo vertical. Entre 5,2–7 s, telefone se preenche e cartões aparecem lateralmente em profundidades distintas. Busca vira resultado, depois acompanhamento. Adotar persistência do objeto e confirmação como conclusão de uma ação; sem copiar a interface comercial. |
| ifood edit, 7,2 s, 576×1024, 30 fps | Ícone arredondado encaixa na interface; câmera aproxima e gira discretamente entre 1,7–3,5 s. Barra se alonga, cartões sucedem a busca, círculo conclui com wipe. Adotar transformação objeto→cartão e curva de aceleração com pausa de leitura. |
| ifood edit2, 14,208 s, 640×576, 30 fps | Busca tem deformação elástica; cartões deslizam horizontalmente com rotação Y entre 3,8–5,6 s. Categorias e confirmação de entrega organizam a narrativa. Adotar navegação de estante, cartão selecionado avançando e check que resolve a jornada. |

## Aplicação original

- Manter livro SVG, Georgia, composição e paleta da abertura. Alterar somente a
  saída final para o verde não desaparecer antes da experiência digital.
- Livro é o fio visual: capa → anúncio → balcão de recebimento → catálogo → retirada.
- Interfaces editoriais grandes, poucos campos e textos legíveis; sem fingir
  captura do frontend. Dados de material, código e instituição são ilustrativos.
- Contraste entre creme, floresta e esmeralda cria capítulos. Coral marca ações.
- Tipografia entra por linhas com máscara, com atrasos curtos. Componentes UI
  usam springs amortecidas; câmera tem inclinação discreta e planos em parallax.
- Cortinas verticais de cor atravessam os cortes de cena; estante usa cards em
  perspectiva; final reduz a velocidade e segura logo/slogan até o último frame.
- Marca: recorte por viewport da logo horizontal oficial na prancha JPG,
  sem redesenhar, distorcer ou sobrescrever a imagem. Ilustração oficial na retirada.
- Sem trilha/locução fornecida: master visual silencioso, sem áudio das referências.

## Plano de implementação e verificação

1. Componentes reutilizáveis: livro, logo recortada, título, painel, badge, check,
   instituição, botões e animações frame-driven. Nenhuma nova dependência.
2. Cenas: abertura 0–89; oportunidade 90–179; doação 180–269;
   recebimento 270–359; catálogo 360–479; retirada 480–569; marca 570–659.
3. Manter a UI entre oportunidade e doação; wipes em 270/360/480/570 cobrem os
   cortes. Fechamento usa logo oficial e slogan, com área segura vertical.
4. TypeScript, composição, stills por cena e limites de transição; render H.264
   CRF 16, 1080×1920/30fps; FFprobe e decodificação completa. Revisão visual dos
   sete momentos, incluindo a leitura de código, estados e ausência de placeholders.
5. Não tocar frontend, não instalar bibliotecas, não fazer commit/push.

export type ChapterInk = 'coral' | 'emerald' | 'forest';

export type Chapter = {
  stage: string;
  stamp: string;
  ink: ChapterInk;
  rotate: number;
  title: string;
  body: string;
  note: string;
};

export const chapters: readonly Chapter[] = [
  {
    stage: 'Entrega',
    stamp: 'Doado',
    ink: 'coral',
    rotate: -5,
    title: 'Você entrega o material em uma instituição parceira.',
    body: 'Escolha a instituição e leve o material pessoalmente. Sem envio e sem encontro entre desconhecidos.',
    note: 'Deixei as melhores partes sublinhadas.',
  },
  {
    stage: 'Conferência',
    stamp: 'Recebido',
    ink: 'emerald',
    rotate: 3,
    title: 'A equipe confere e coloca no acervo.',
    body: 'A instituição confirma o recebimento presencialmente. Só depois disso o material aparece para outros estudantes.',
    note: 'Página 112: releia antes da prova.',
  },
  {
    stage: 'Reserva',
    stamp: 'Reservado',
    ink: 'forest',
    rotate: -2,
    title: 'Outro estudante encontra e reserva.',
    body: 'Quem precisa reserva o material no acervo e recebe um código de retirada de uso único.',
    note: 'Os exercícios do fim valem a pena.',
  },
  {
    stage: 'Retirada',
    stamp: 'Retirado',
    ink: 'coral',
    rotate: 6,
    title: 'O conhecimento segue para a próxima leitura.',
    body: 'A retirada acontece na mesma instituição, com o código apresentado à equipe.',
    note: 'Agora é a sua vez de anotar.',
  },
];

export function activeChapter(visible: readonly boolean[]): number {
  let active = -1;
  for (let index = 0; index < visible.length; index += 1) {
    if (visible[index]) active = index;
  }
  return active;
}

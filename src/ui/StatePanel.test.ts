import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { errorKind, StatePanel } from './StatePanel';

test('catalog errors give visitors a recovery action specific to the response', () => {
  for (const [status, heading, action] of [
    [400, 'Consulta inválida', 'Ir para o acervo'],
    [401, 'Sessão necessária', 'Ir para o acervo'],
    [403, 'Acesso restrito', 'Ir para o acervo'],
    [404, 'Página indisponível', 'Ir para o acervo'],
    [409, 'O material mudou de situação', 'Ir para o acervo'],
    [429, 'Muitas consultas em pouco tempo', 'Tentar novamente'],
    [503, 'Não foi possível consultar o acervo', 'Tentar novamente'],
  ] as const) {
    const panel = createElement(StatePanel, { kind: errorKind({ status }), retry: () => {} });
    const output = renderToStaticMarkup(createElement(MemoryRouter, {}, panel));
    assert.ok(output.includes(heading), String(status));
    assert.ok(output.includes(action), String(status));
  }
});

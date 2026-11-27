import test from 'node:test';
import assert from 'node:assert/strict';
import { activeChapter, chapters } from './cinematicStory.ts';

test('activeChapter returns -1 when no chapter is visible', () => {
  assert.equal(activeChapter([]), -1);
  assert.equal(activeChapter([false, false, false, false]), -1);
});

test('activeChapter returns the last visible chapter', () => {
  assert.equal(activeChapter([true]), 0);
  assert.equal(activeChapter([true, true, false, false]), 1);
  assert.equal(activeChapter([false, false, true, true]), 3);
});

test('the story has four chapters in stamp order', () => {
  assert.equal(chapters.length, 4);
  assert.deepEqual(
    chapters.map((chapter) => chapter.stamp),
    ['Doado', 'Recebido', 'Reservado', 'Retirado'],
  );
});

export interface SheetDef {
  url: string;
  w: number;
  h: number;
}

export interface CropBox {
  sheetId: 'covers' | 'spines' | 'fix' | 'fix2';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FilmData {
  id: string;
  index: number;
  title: string;
  romaji: string;
  kanji: string;
  year: number;
  decade: '1950s' | '1960s' | '1970s' | '1980s';
  genre: string;
  minutes: number;
  synopsis: string;
  spineCrop: CropBox;
  coverCrop: CropBox;
}

export type DecadeTabId = 'all' | '1950s' | '1960s' | '1970s' | '1980s';

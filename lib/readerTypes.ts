// 閱讀模式共用型別（前後端共用）
export interface BookPage {
  pageNumber: number;
  original: string;
  translated: string;
}

export interface BookMeta {
  id: string;
  title: string;
  pageCount: number;
  createdAt: string;
}

export interface Book extends BookMeta {
  pages: BookPage[];
}

export interface VocabItem {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  sentence: string;
  bookTitle: string;
  createdAt: string;
}

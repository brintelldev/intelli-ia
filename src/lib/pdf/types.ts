export type ExtractedPage = { number: number; content: string; tokenCount: number };

export type ExtractedDocument = {
  text: string;
  pages: ExtractedPage[];
  isScanned: boolean;
  isProtected: boolean;
};

export type Chunk = {
  content: string;
  metadata: { index: number; startPage: number; sectionTitle?: string };
};

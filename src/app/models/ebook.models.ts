export interface EbookDownloadOption {
  url: string;
  label?: string;
}

export interface Ebook {
  title: string;
  filename: string;
  collectionId?: number;
  externalFileURL?: string;
  coverURL?: string;
  downloadOptions?: EbookDownloadOption[];
}

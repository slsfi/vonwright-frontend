export interface HeadingNode {
  id: string | null;
  text: string;
  level: number;
  children: HeadingNode[];
}

export interface DownloadOption {
  url: string;
  label?: string;
}

export interface Article {
  id: string;
  language: string;
  routeName: string;
  title?: string;
  coverURL?: string;
  enableTOC?: boolean;
  downloadOptions?: DownloadOption[];
}

export interface ArticlesData {
  articles: Article[];
}

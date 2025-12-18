export class ContentItem {
  id: string;
  imageAltText?: string;
  imageURL?: string;
  title: string;
  type: string;

  constructor(obj: any) {
    this.id = obj.routeName || obj.id || obj.filename;
    this.imageAltText = obj.imageAltText || obj.title || undefined;
    this.imageURL = obj.coverURL || obj.imageURL || undefined;
    this.title = obj.title;
    this.type = obj.type || (obj.filename ? 'ebook' : (obj.routeName ? 'article' : null)) || 'collection';
  }
}

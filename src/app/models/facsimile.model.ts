export class Facsimile {
  content = '';
  facsimile_id: number;
  id: number;
  images: any = [];
  itemId: string;
  manuscript_id: number;
  number_of_pages: number;
  page: number;
  page_nr: number;
  pages: number;
  pre_page_count: number;
  priority: number;
  publication_facsimile_collection_id: number;
  title: any;
  type: number;
  zoom: number;
  zoomedImages: any = [];

  constructor(facsimileInfo: any) {
    this.id = facsimileInfo.id;
    this.zoom = 1;
    this.page = (facsimileInfo.start_page_number || 0) + (facsimileInfo.page_nr || 0);
    this.page_nr = (facsimileInfo.page_nr || 0);
    this.pages = facsimileInfo.pages;
    this.pre_page_count = facsimileInfo.start_page_number;
    this.type = facsimileInfo.type;
    this.title = facsimileInfo.title;
    this.itemId = facsimileInfo.itemId;
    this.manuscript_id = facsimileInfo.manuscript_id;
    this.publication_facsimile_collection_id = facsimileInfo.publication_facsimile_collection_id;
    this.facsimile_id = facsimileInfo.publication_facsimile_id;
    this.number_of_pages = facsimileInfo.number_of_pages;
    this.priority = facsimileInfo.priority;
  }
}

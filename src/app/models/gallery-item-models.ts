export class GalleryItem {
    collectionID: number;
    description?: string;
    filename: string;
    id: string;
    imageAltText?: string;
    imageURL: string;
    imageURLThumb?: string;
    imageURLBack?: string;
    sortOrder?: number;
    subItemCount?: number;
    subTitle?: string;
    title?: string;
    visible: boolean;

    constructor(obj: any) {
        this.collectionID = obj.collection_id || obj.media_collection_id || obj.id;
        this.description = obj.description || undefined;
        this.filename = obj.front || obj.filename;
        this.imageURL = obj.imageURL || this.filename;
        this.id = String(this.collectionID) + '_' + this.imageURL;
        this.imageURLThumb = this.imageURL;
        this.imageURLBack = obj.imageURLBack || obj.back || undefined;
        this.sortOrder = obj.sortOrder || obj.sort_order || undefined;
        this.subItemCount = obj.subItemCount || obj.mediaCount || obj.media_count || undefined;
        this.title = obj.full_name || obj.name || (obj.front ? obj.media_title_translation : obj.title) || undefined;
        this.subTitle = obj.subTitle || obj.subject_name || undefined;
        this.imageAltText = obj.imageAltText || this.title;
        this.visible = true;
    }
}

export interface MediaCollectionApiResponse {
  date_created: string | null;
  date_modified: string | null;
  deleted: number;
  description?: string | null;
  description_translation_id: number | null;
  id: number;
  image_path: string | null;
  media_count: number | null;
  project_id: number;
  sort_order: number | null;
  title: string | null;
  title_translation_id: number | null;
}

export interface MediaCollection {
  description?: string;
  id: number;
  imagePath?: string;
  mediaCount?: number;
  sortOrder?: number;
  title: string;
}

export const toMediaCollection = (mc: MediaCollectionApiResponse): MediaCollection => ({
  description: mc.description ?? undefined,
  id: mc.id,
  imagePath: mc.image_path ?? undefined,
  mediaCount: mc.media_count ?? undefined,
  sortOrder: mc.sort_order ?? undefined,
  title: mc.title ?? ''
});

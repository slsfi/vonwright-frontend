export interface VariantApi {
  content: string;
  id: number;
  legacy_id: string | null;
  name: string | null;
  original_filename: string | null;
  sort_order: number | null;
  type: number | null;
  [key: string]: unknown; // tolerate extra fields from the backend
}

export interface VariantsApiResponse {
  id: string;
  variations: VariantApi[];
}

export interface Variant {
  id: number;
  html: string;
  name: string;
  sortOrder: number;
}

export const toVariant = (v: VariantApi): Variant => ({
  id: v.id,
  html: v.content,
  name: v.name ?? '',
  sortOrder: v.sort_order ?? 1,
});

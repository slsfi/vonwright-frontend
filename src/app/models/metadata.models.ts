export interface CorrespondenceMetadataApiResponse {
  letter: LetterDataApiResponse;
  subjects: CorrespondentDataApiResponse[];
}

export interface CorrespondenceMetadata {
  letter: LetterData;
  subjects: CorrespondentData[];
}

export interface LetterDataApiResponse {
  correspondence_collection_id: number | null;
  correspondence_collection_id_legacy: number | null;
  date_created: string | null;
  date_modified: string | null;
  date_sent: string | null;
  deleted: number | null;
  description: string | null;
  full_name: string | null;
  id: number | null;
  language: string | null;
  leaf_count: string | null;
  legacy_id: string | null;
  material: string | null;
  material_color: string | null;
  material_format: string | null;
  material_notes: string | null;
  material_pattern: string | null;
  material_quality: string | null;
  material_source: string | null;
  material_state: string | null;
  material_type: string | null;
  page_count: string | null;
  project_id: number | null;
  sheet_count: string | null;
  source_archive: string | null;
  source_collection_id: string | null;
  source_id: string | number | null;
  subject_id: number | null;
  title: string | null;
  type: string | null;
}

export interface LetterData {
  correspondence_collection_id: number | null;
  correspondence_collection_id_legacy: number | null;
  date_created: string | null;
  date_modified: string | null;
  date_sent: string | null;
  deleted: number | null;
  description: string | null;
  full_name: string | null;
  id: number | null;
  language: string | null;
  leaf_count: string | null;
  legacy_id: string | null;
  material: string | null;
  material_color: string | null;
  material_format: string | null;
  material_notes: string | null;
  material_pattern: string | null;
  material_quality: string | null;
  material_source: string | null;
  material_state: string | null;
  material_type: string | null;
  page_count: string | null;
  project_id: number | null;
  sheet_count: string | null;
  source_archive: string | null;
  source_collection_id: string | null;
  source_id: string | number | null;
  subject_id: number | null;
  title: string | null;
  type: string | null;
}

export interface CorrespondentDataApiResponse {
  id: number;
  avsändare?: string | null;
  mottagare?: string | null;
}

export interface CorrespondentData {
  id: number;
  sender?: string | null;
  receiver?: string | null;
}

export interface FacsimileMetadata {
  archive_info: string | null;
  external_url: string | null;
  facs_coll_id: number | null;
  facsimile_title: string | null;
  image_number_info: string | null;
  number_of_images: number | null;
  priority: number | null;
}

export interface TranslationMetadata {
  translated_into: string | null;
  translators: string[] | null;
}

export interface PublicationMetadataApiResponse {
  author: string[] | null;
  document_type: string | null;
  facsimiles: FacsimileMetadata[] | null;
  id: string | null;
  manuscript_id: number | null;
  original_language: string | null;
  publication_date: string | null;
  publication_subtitle: string | null;
  publication_title: string | null;
  published_by: string | null;
  recipient: string[] | null;
  sender: string[] | null;
  translations: TranslationMetadata[] | null;
}

export interface PublicationMetadata {
  author: string[];
  document_type: string | null;
  facsimiles: FacsimileMetadata[];
  id: string | null;
  manuscript_id: number | null;
  original_language: string | null;
  publication_date: string | null;
  publication_subtitle: string | null;
  publication_title: string | null;
  published_by: string | null;
  recipient: string[];
  sender: string[];
  translations: TranslationMetadata[];
}

export const toCorrespondent = (
  c: CorrespondentDataApiResponse
): CorrespondentData => ({
  id: c.id,
  sender: c.avsändare ?? null,
  receiver: c.mottagare ?? null,
});

export const toCorrespondenceMetadata = (
  api: CorrespondenceMetadataApiResponse
): CorrespondenceMetadata => ({
  // Letter can be passed directly because types match
  letter: { ...api.letter },

  // Subjects need mapping
  subjects: api.subjects.map(toCorrespondent),
});

export const toPublicationMetadata = (
  m: PublicationMetadataApiResponse
): PublicationMetadata => ({
  author: m.author ?? [],
  document_type: m.document_type,
  facsimiles: m.facsimiles ?? [],
  id: m.id,
  manuscript_id: m.manuscript_id,
  original_language: m.original_language,
  publication_date: m.publication_date,
  publication_subtitle: m.publication_subtitle,
  publication_title: m.publication_title,
  published_by: m.published_by,
  recipient: m.recipient ?? [],
  sender: m.sender ?? [],
  translations: m.translations ?? []
});

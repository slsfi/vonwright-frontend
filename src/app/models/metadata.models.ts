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

export interface FacsimileMetadataApiResponse {
  archive_info?: string | null;
  description?: string | null;
  external_url?: string | null;
  facs_coll_id?: number | null;
  facsimile_title?: string | null;
  image_number_info?: string | null;
  number_of_images?: number | null;
  page_nr?: number | null;
  priority?: number | null;
  publication_manuscript_id?: number | null;
  publication_variant_id?: number | null;
  section_id?: string | null;
  title?: string | null;
  [key: string]: unknown;
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

export interface ManuscriptMetadataApiResponse {
  author?: string[] | null;
  facsimile_summary?: string | null;
  id?: number | null;
  language?: string | null;
  licence?: string | null;
  licence_encoding?: string | null;
  licence_work?: string | null;
  orig_date?: string | null;
  phys_description?: string | null;
  phys_dimensions?: string | null;
  responsibility?: ResponsibilityMetadataApiResponse[] | null;
  rights?: string | null;
  section_id?: string | null;
  sort_order?: number | null;
  source_archive?: string | null;
  source_bibl?: string | null;
  title?: string | null;
  [key: string]: unknown;
}

export interface ManuscriptMetadata {
  author: string[];
  facsimile_summary: string | null;
  id: number | null;
  language: string | null;
  licence: string | null;
  licence_encoding: string | null;
  licence_work: string | null;
  orig_date: string | null;
  phys_description: string | null;
  phys_dimensions: string | null;
  responsibility: ResponsibilityMetadata[];
  rights: string | null;
  sort_order: number | null;
  source_archive: string | null;
  source_bibl: string | null;
  title: string | null;
}

export interface TranslationMetadata {
  translated_into: string | null;
  translators: string[] | null;
}

export interface ResponsibilityMetadataApiResponse {
  resp?: string | null;
  names?: string[] | null;
  [key: string]: unknown;
}

export interface ResponsibilityMetadata {
  resp: string;
  names: string[];
}

export interface MetadataIndexEntryApiResponse {
  id?: string | number | null;
  name?: string | null;
  [key: string]: unknown;
}

export interface MetadataIndexEntry {
  id: string | number;
  name: string;
}

export type PublicationIndexMetadata = MetadataIndexEntry[] | null;
export type PublicationKeywordsMetadata = string | PublicationIndexMetadata;

export interface VariantMetadataApiResponse {
  author?: string[] | null;
  facsimile_summary?: string | null;
  id?: number | null;
  language?: string | null;
  licence?: string | null;
  licence_encoding?: string | null;
  licence_work?: string | null;
  orig_date?: string | null;
  phys_description?: string | null;
  phys_dimensions?: string | null;
  responsibility?: ResponsibilityMetadataApiResponse[] | null;
  rights?: string | null;
  section_id?: string | null;
  sort_order?: number | null;
  source_archive?: string | null;
  source_bibl?: string | null;
  title?: string | null;
  type?: number | null;
  [key: string]: unknown;
}

export interface VariantMetadata {
  author: string[];
  facsimile_summary: string | null;
  id: number | null;
  language: string | null;
  licence: string | null;
  licence_encoding: string | null;
  licence_work: string | null;
  orig_date: string | null;
  phys_description: string | null;
  phys_dimensions: string | null;
  responsibility: ResponsibilityMetadata[];
  rights: string | null;
  sort_order: number | null;
  source_archive: string | null;
  source_bibl: string | null;
  title: string | null;
  type: number | null;
}

export interface PublicationMetadataApiResponse {
  author?: string[] | null;
  collection_id?: number | null;
  collection_title?: string | null;
  document_type?: string | null;
  facsimile_summary?: string | null;
  facsimiles?: FacsimileMetadataApiResponse[] | null;
  id?: string | number | null;
  keywords?: string | MetadataIndexEntryApiResponse[] | null;
  licence?: string | null;
  licence_encoding?: string | null;
  licence_work?: string | null;
  manuscript_id?: number | null;
  manuscripts?: ManuscriptMetadataApiResponse[] | null;
  original_language?: string | null;
  persons?: MetadataIndexEntryApiResponse[] | null;
  phys_description?: string | null;
  phys_dimensions?: string | null;
  places?: MetadataIndexEntryApiResponse[] | null;
  publication_date?: string | null;
  publication_genre?: string | null;
  publication_language?: string | null;
  publication_subtitle?: string | null;
  publication_title?: string | null;
  published_by?: string | null;
  recipient?: string[] | null;
  responsibility?: ResponsibilityMetadataApiResponse[] | null;
  rights?: string | null;
  sender?: string[] | null;
  source_archive?: string | null;
  source_bibl?: string | null;
  translations?: TranslationMetadata[] | null;
  variants?: VariantMetadataApiResponse[] | null;
  [key: string]: unknown;
}

export interface PublicationMetadata {
  author: string[];
  collection_id: number | null;
  collection_title: string | null;
  document_type: string | null;
  facsimile_summary: string | null;
  facsimiles: FacsimileMetadata[];
  id: string | null;
  keywords: PublicationKeywordsMetadata;
  licence: string | null;
  licence_encoding: string | null;
  licence_work: string | null;
  manuscript_id: number | null;
  manuscripts: ManuscriptMetadata[];
  original_language: string | null;
  persons: PublicationIndexMetadata;
  phys_description: string | null;
  phys_dimensions: string | null;
  places: PublicationIndexMetadata;
  publication_date: string | null;
  publication_genre: string | null;
  publication_language: string | null;
  publication_subtitle: string | null;
  publication_title: string | null;
  published_by: string | null;
  recipient: string[];
  responsibility: ResponsibilityMetadata[];
  rights: string | null;
  sender: string[];
  source_archive: string | null;
  source_bibl: string | null;
  translations: TranslationMetadata[];
  variants: VariantMetadata[];
}

export interface ReferenceData {
  intro_reference_text: string | null;
  reference_text: string | null;
  urn: string | null;
}

export interface ReferenceDataApiResponse {
  date_created?: string | null;
  date_modified?: string | null;
  deleted?: number | null;
  id?: number | null;
  intro_reference_text?: string | null;
  legacy_id?: string | null;
  project_id?: number | null;
  reference_text?: string | null;
  url?: string | null;
  urn?: string | null;
  [key: string]: unknown;
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

export const toFacsimileMetadata = (
  f: FacsimileMetadataApiResponse
): FacsimileMetadata => ({
  archive_info: f.archive_info ?? null,
  external_url: f.external_url ?? null,
  facs_coll_id: f.facs_coll_id ?? null,
  facsimile_title: f.facsimile_title ?? f.title ?? null,
  image_number_info: f.image_number_info ?? null,
  number_of_images: f.number_of_images ?? null,
  priority: f.priority ?? null,
});

const toResponsibilityMetadata = (
  responsibility: ResponsibilityMetadataApiResponse
): ResponsibilityMetadata | null => {
  const resp = responsibility.resp ?? '';
  const names = Array.isArray(responsibility.names)
    ? responsibility.names.filter((name): name is string => typeof name === 'string')
    : [];

  if (!resp && !names.length) {
    return null;
  }

  return { resp, names };
};

const toResponsibilityMetadataList = (
  responsibilities: ResponsibilityMetadataApiResponse[] | null | undefined
): ResponsibilityMetadata[] => (responsibilities ?? [])
  .map(toResponsibilityMetadata)
  .filter((responsibility): responsibility is ResponsibilityMetadata => responsibility !== null);

export const toManuscriptMetadata = (
  m: ManuscriptMetadataApiResponse
): ManuscriptMetadata => ({
  author: m.author ?? [],
  facsimile_summary: m.facsimile_summary ?? null,
  id: m.id ?? null,
  language: m.language ?? null,
  licence: m.licence ?? null,
  licence_encoding: m.licence_encoding ?? null,
  licence_work: m.licence_work ?? null,
  orig_date: m.orig_date ?? null,
  phys_description: m.phys_description ?? null,
  phys_dimensions: m.phys_dimensions ?? null,
  responsibility: toResponsibilityMetadataList(m.responsibility),
  rights: m.rights ?? null,
  sort_order: m.sort_order ?? null,
  source_archive: m.source_archive ?? null,
  source_bibl: m.source_bibl ?? null,
  title: m.title ?? null,
});

export const toVariantMetadata = (
  v: VariantMetadataApiResponse
): VariantMetadata => ({
  author: v.author ?? [],
  facsimile_summary: v.facsimile_summary ?? null,
  id: v.id ?? null,
  language: v.language ?? null,
  licence: v.licence ?? null,
  licence_encoding: v.licence_encoding ?? null,
  licence_work: v.licence_work ?? null,
  orig_date: v.orig_date ?? null,
  phys_description: v.phys_description ?? null,
  phys_dimensions: v.phys_dimensions ?? null,
  responsibility: toResponsibilityMetadataList(v.responsibility),
  rights: v.rights ?? null,
  sort_order: v.sort_order ?? null,
  source_archive: v.source_archive ?? null,
  source_bibl: v.source_bibl ?? null,
  title: v.title ?? null,
  type: v.type ?? null,
});

const toMetadataIndexEntry = (
  entry: MetadataIndexEntryApiResponse
): MetadataIndexEntry | null => {
  if (entry.id == null || entry.name == null) {
    return null;
  }

  return {
    id: entry.id,
    name: entry.name,
  };
};

const toPublicationIndexMetadata = (
  entries: MetadataIndexEntryApiResponse[] | null | undefined
): PublicationIndexMetadata => {
  const mapped = (entries ?? [])
    .map(toMetadataIndexEntry)
    .filter((entry): entry is MetadataIndexEntry => entry !== null);

  return mapped.length ? mapped : null;
};

const toPublicationKeywordsMetadata = (
  keywords: PublicationMetadataApiResponse['keywords']
): PublicationKeywordsMetadata => {
  if (Array.isArray(keywords)) {
    const mapped = keywords
      .map(toMetadataIndexEntry)
      .filter((k): k is MetadataIndexEntry => k !== null);

    return mapped.length ? mapped : null;
  }

  return keywords ?? null;
};

export const toPublicationMetadata = (
  p: PublicationMetadataApiResponse
): PublicationMetadata => ({
  author: p.author ?? [],
  collection_id: p.collection_id ?? null,
  collection_title: p.collection_title ?? null,
  document_type: p.document_type ?? null,
  facsimile_summary: p.facsimile_summary ?? null,
  facsimiles: (p.facsimiles ?? []).map(toFacsimileMetadata),
  id: p.id == null ? null : String(p.id),
  keywords: toPublicationKeywordsMetadata(p.keywords),
  licence: p.licence ?? null,
  licence_encoding: p.licence_encoding ?? null,
  licence_work: p.licence_work ?? null,
  manuscript_id: p.manuscript_id ?? null,
  manuscripts: (p.manuscripts ?? []).map(toManuscriptMetadata),
  original_language: p.original_language ?? null,
  persons: toPublicationIndexMetadata(p.persons),
  phys_description: p.phys_description ?? null,
  phys_dimensions: p.phys_dimensions ?? null,
  places: toPublicationIndexMetadata(p.places),
  publication_date: p.publication_date ?? null,
  publication_genre: p.publication_genre ?? null,
  publication_language: p.publication_language ?? null,
  publication_subtitle: p.publication_subtitle ?? null,
  publication_title: p.publication_title ?? null,
  published_by: p.published_by ?? null,
  recipient: p.recipient ?? [],
  responsibility: toResponsibilityMetadataList(p.responsibility),
  rights: p.rights ?? null,
  sender: p.sender ?? [],
  source_archive: p.source_archive ?? null,
  source_bibl: p.source_bibl ?? null,
  translations: p.translations ?? [],
  variants: (p.variants ?? []).map(toVariantMetadata),
});

export const toReferenceData = (
  r: ReferenceDataApiResponse
): ReferenceData => ({
  intro_reference_text: r.intro_reference_text ?? null,
  reference_text: r.reference_text ?? null,
  urn: r.urn ?? null
});

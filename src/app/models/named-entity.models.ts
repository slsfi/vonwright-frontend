export interface NamedEntityAuthor {
  id?: string | number | null;
  full_name?: string | null;
  [key: string]: unknown;
}

export interface NamedEntityDetails {
  id?: number | null;
  title?: string | null;
  full_name?: string | null;
  name?: string | null;
  date_born?: string | null;
  date_deceased?: string | null;
  occupation?: string | null;
  year_born_deceased?: string | null;
  lived_between?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  place_of_birth?: string | null;
  type?: string | null;
  source?: string | null;
  publisher?: string | null;
  published_year?: string | number | null;
  isbn?: string | null;
  journal?: string | null;
  description?: string | null;
  alias?: string | null;
  previous_last_name?: string | null;
  author_data?: NamedEntityAuthor[];
  [key: string]: unknown;
}

export interface NamedEntityMedia {
  image_path?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  [key: string]: unknown;
}

export interface NamedEntityArticle {
  description?: string | null;
  pdf_path?: string | null;
  [key: string]: unknown;
}

export interface NamedEntityGalleryOccurrence {
  id?: string | number | null;
  [key: string]: unknown;
}

export interface NamedEntityModalData {
  details: NamedEntityDetails;
  media: NamedEntityMedia;
  articles: NamedEntityArticle[];
  galleryOccurrences: NamedEntityGalleryOccurrence[];
}

export type NamedEntityModalDataResponse = [
  NamedEntityDetails,
  NamedEntityMedia,
  NamedEntityArticle[] | Record<string, unknown>,
  NamedEntityGalleryOccurrence[] | Record<string, unknown>
];

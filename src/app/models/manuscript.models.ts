export interface ManuscriptApi {
  id: number;
  name: string | null;
  manuscript_changes: string;
  manuscript_normalized: string;
  language: string | null;
  [key: string]: unknown; // tolerate extra fields from the backend
}

export interface ManuscriptsApiResponse {
  id: string;
  manuscripts: ManuscriptApi[];
}

export interface Manuscript {
  id: number;
  name: string;
  changesHtml: string;
  normalizedHtml: string;
  language?: string;
}

export const toManuscript = (m: ManuscriptApi): Manuscript => ({
  id: m.id,
  name: m.name ?? '',
  changesHtml: m.manuscript_changes,
  normalizedHtml: m.manuscript_normalized,
  language: m.language ?? undefined,
});

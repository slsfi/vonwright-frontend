export type ViewFlags = {
  comments: boolean;
  personInfo: boolean;
  abbreviations: boolean;
  placeInfo: boolean;
  workInfo: boolean;
  emendations: boolean;
  normalisations: boolean;
  paragraphNumbering: boolean;
  pageBreakOriginal: boolean;
  pageBreakEdition: boolean;
};

export type VariationType = 'all' | 'sub' | 'none';

export const TEXT_SIZES = ['xsmall','small','medium','large','xlarge'] as const;
export type Textsize = typeof TEXT_SIZES[number];

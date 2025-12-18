export interface AggregationData {
  buckets?: Facet[];
  filtered?: {
    buckets: Facet[];
  }
}

export interface AggregationQuery {
  queries: string[];
  facetGroups?: any;
  range?: TimeRange;
}

export interface AggregationsData {
  [aggregationKey: string]: AggregationData;
}

export interface Facet {
  doc_count: number;
  key: string | number;
  key_as_string?: string;
  selected?: boolean;
}

export interface Facets {
  [facetKey: string]: Facet;
}

export interface SearchQuery {
  queries: string[];
  highlight: object;
  from: number;
  size: number;
  facetGroups?: any;
  range?: TimeRange;
  sort?: object[];
}

export interface TimeRange {
  from?: string | number;
  to?: string | number;
}

export interface YearBucket {
  key: number | string;       // ES key (not heavily used here)
  key_as_string: string;      // "YYYY"
  doc_count: number;          // total docs (unfiltered aggregation)
  doc_count_current?: number; // docs with current filters
}

export interface YearRange {
  from: string | null; // "YYYY" or null
  to: string | null;   // "YYYY" or null
}

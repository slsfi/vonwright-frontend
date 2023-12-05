export interface AggregationData {
  buckets?: Facet[]
  filtered?: {
    buckets: Facet[]
  }
}

export interface AggregationQuery {
  queries: string[]
  facetGroups?: any
  range?: TimeRange
}

export interface AggregationsData {
  [aggregationKey: string]: AggregationData
}

export interface Facet {
  doc_count: number
  key: string | number
  key_as_string?: string
  selected?: boolean
}

export interface Facets {
  [facetKey: string]: Facet
}

export interface SearchQuery {
  queries: string[]
  highlight: object
  from: number
  size: number
  facetGroups?: any
  range?: TimeRange
  sort?: object[]
}

export interface TimeRange {
  from?: string | number
  to?: string | number
}

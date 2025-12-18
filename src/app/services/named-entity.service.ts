import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { config } from '@config';
import { convertNamedEntityTypeForBackend, isEmptyObject } from '@utility-functions';


@Injectable({
  providedIn: 'root',
})
export class NamedEntityService {
  private http = inject(HttpClient);
  private activeLocale = inject(LOCALE_ID);

  private readonly apiURL: string = `${config.app?.backendBaseURL ?? ''}/${config.app?.projectNameDB ?? ''}`;
  private readonly elasticLocationIndex: string = 'location';
  private readonly elasticSubjectIndex: string = 'subject';
  private readonly elasticTagIndex: string = 'tag';
  private readonly elasticWorkIndex: string = 'work';
  private readonly multilingual: boolean = config.app?.i18n?.multilingualNamedEntityData ?? false;

  /**
   * Get details of a single named entity.
   * @param type type of the named entity: keyword/tag, person/subject, place/location, work
   * @param id of the named entity
   */
  getEntity(type: string, id: string): Observable<any> {
    type = convertNamedEntityTypeForBackend(type);
    const locale = this.multilingual ? '/' + this.activeLocale : '';
    const endpoint = `${this.apiURL}/${type}/${id}${locale}`;
    return this.http.get(endpoint);
  }

  /**
   * Get all occurrences of a single named entity (texts, facsimiles etc. where
   * the entity occurs).
   * TODO: check if this should use the project specific endpoints instead,
   * TODO: for instance "/<project>/subject/occurrences/<subject_id>/"
   * @param type of the named entity: keyword/tag, person/subject, place/location, work
   * @param id of the named entity
   */
  getEntityOccurrences(type: string, id: string): Observable<any> {
    type = convertNamedEntityTypeForBackend(type);
    const endpoint = `${config.app.backendBaseURL}/occurrences/${type}/${id}`;
    return this.http.get(endpoint);
  }

  /**
   * Get data of articles connected to a single named entity.
   * @param type of the named entity: keyword/tag, person/subject, place/location, work
   * @param id of the named entity
   */
  getEntityArticleData(type: string, id: string): Observable<any> {
    type = convertNamedEntityTypeForBackend(type);
    const endpoint = `${this.apiURL}/media/articles/${type}/${id}`;
    return this.http.get(endpoint);
  }

  /**
   * Get first occurrence of a single named entity in media collections. Can be used
   * to check if the entity has connections to media collections.
   * @param type of the named entity: keyword/tag, person/subject, place/location, work
   * @param id of the named entity
   */
  getEntityMediaCollectionOccurrences(type: string, id: string) {
    type = convertNamedEntityTypeForBackend(type);
    const endpoint = `${this.apiURL}/gallery/${type}/connections/${id}/1`;
    return this.http.get(endpoint);
  }

  /**
   * Get data of media connected to a single named entity.
   * @param type of the named entity: keyword/tag, person/subject, place/location, work
   * @param id of the named entity
   */
  getEntityMediaData(type: string, id: string): Observable<any> {
    type = convertNamedEntityTypeForBackend(type);
    const endpoint = `${this.apiURL}/media/data/${type}/${id}`;
    return this.http.get(endpoint);
  }

  /**
   * Get details of all persons in specific language. This function fetches
   * data from the backend database, not ElasticSearch.
   */
  getPersons(language: string): Observable<any> {
    const endpoint = `${this.apiURL}/persons/${language}`;
    return this.http.get(endpoint);
  }

  /**
   * Get details of a single named entity from ElasticSearch. In practice,
   * this function is only used to get details of works.
   * @param type of the named entity: keyword/tag, person/subject, place/location, work
   * @param id of the named entity
   */
  getEntityFromElastic(type: string, id: string) {
    type = convertNamedEntityTypeForBackend(type);

    const payload: any = {
      from: 0,
      size: 200,
      query: {
        bool: {
          should: [
            {
              bool: {
                must: [
                  {
                    term: {
                      project_id: config.app.projectId,
                    },
                  },
                  {
                    term: { id: id },
                  },
                ],
              },
            },
            {
              bool: {
                must: [
                  {
                    term: {
                      project_id: config.app.projectId,
                    },
                  },
                  {
                    term: { legacy_id: id },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    if (type === 'work') {
      payload.query.bool.should[0].bool.must[1]['term'] = { man_id: id };
    }

    // remove if the ID is not strictly numerical
    if (/^\d+$/.test(id) === false) {
      delete payload.query.bool.should[0];
    }

    return this.http.post<any>(this.getElasticSearchUrl(type), payload);
  }

  /**
   * Get details of all keywords from ElasticSearch.
   * @param after_key key of last record of previous fetch (used for "pagination")
   * @param searchText to apply to keyword names
   * @param filters to apply to the query
   * @param max number of records to retrieve
   */
  getKeywordsFromElastic(after_key?: any, searchText?: string, filters?: any, max?: number) {
    const showPublishedStatus = config.page?.index?.keywords?.publishedStatus ?? 2;

    if (filters === null || filters === undefined) {
      filters = {};
    }

    if (max === undefined || max === null) {
      max = 500;
    } else if (max > 10000) {
      max = 10000;
    }

    const payload: any = {
      size: 0,
      query: {
        bool: {
          must: [
            {
              term: {
                project_id: { value: config.app.projectId },
              },
            },
            { term: { published: { value: showPublishedStatus } } },
            { term: { tag_deleted: { value: 0 } } },
            { term: { ev_c_deleted: { value: 0 } } },
            { term: { ev_o_deleted: { value: 0 } } },
            { term: { publication_deleted: { value: 0 } } },
          ],
        },
      },
      aggs: {
        unique_tags: {
          composite: {
            size: max,
            sources: [
              {
                sort_by_name: {
                  terms: {
                    field: 'sort_by_name.keyword',
                    missing_bucket: true,
                  },
                },
              },
              { name: { terms: { field: 'name.keyword' } } },
              {
                tag_type: {
                  terms: { field: 'tag_type.keyword', missing_bucket: true },
                },
              },
              { id: { terms: { field: 'id' } } },
              { tag_id: { terms: { field: 'tag_id' } } },
            ],
          },
        },
      },
    };

    if (
      after_key !== undefined &&
      !isEmptyObject(after_key)
    ) {
      payload.aggs.unique_tags.composite.after = after_key;
    }

    if (filters?.['filterCategoryTypes']?.length > 0) {
      payload.query.bool.must.push({ bool: { should: [] } });
      filters['filterCategoryTypes'].forEach((element: any) => {
        payload.query.bool.must[
          payload.query.bool.must.length - 1
        ].bool.should.push({
          term: { 'tag_type.keyword': String(element.name) },
        });
      });
    }

    if (
      searchText &&
      String(searchText).length === 1
    ) {
      // Search for first character of tag name
      payload.query.bool.must.push({
        regexp: {
          'sort_by_name.keyword': {
            value: `${String(searchText)}.*|${String(
              searchText
            ).toLowerCase()}.*`,
          },
        },
      });
    } else if (searchText) {
      // Substring search in full tag name
      payload.query.bool.must.push({
        wildcard: {
          name: {
            value: `*${String(searchText)}*`,
            case_insensitive: true,
          },
        },
      });
    }

    return this.http.post<any>(this.getElasticSearchUrl(this.elasticTagIndex), payload);
  }

  /**
   * Get details of all persons from ElasticSearch.
   * @param after_key key of last record of previous fetch (used for "pagination")
   * @param searchText to apply to person names
   * @param filters to apply to the query
   * @param max number of records to retrieve
   */
  getPersonsFromElastic(after_key?: any, searchText?: string, filters?: any, max?: number) {
    const showPublishedStatus = config.page?.index?.persons?.publishedStatus ?? 2;

    if (filters === null || filters === undefined) {
      filters = {};
    }

    if (max === undefined || max === null) {
      max = 500;
    } else if (max > 10000) {
      max = 10000;
    }

    const payload: any = {
      size: 0,
      query: {
        bool: {
          must: [
            {
              term: {
                project_id: { value: config.app.projectId },
              },
            },
            { term: { published: { value: showPublishedStatus } } },
            { term: { sub_deleted: { value: 0 } } },
            { term: { ev_c_deleted: { value: 0 } } },
            { term: { ev_o_deleted: { value: 0 } } },
            { term: { publication_deleted: { value: 0 } } },
          ],
        },
      },
      aggs: {
        unique_subjects: {
          composite: {
            size: max,
            sources: [
              {
                sort_by_name: {
                  terms: {
                    field: 'sort_by_name.keyword',
                    missing_bucket: true,
                  },
                },
              },
              { full_name: { terms: { field: 'full_name.keyword' } } },
              {
                date_born: {
                  terms: { field: 'date_born.keyword', missing_bucket: true },
                },
              },
              {
                date_deceased: {
                  terms: {
                    field: 'date_deceased.keyword',
                    missing_bucket: true,
                  },
                },
              },
              {
                type: {
                  terms: { field: 'type.keyword', missing_bucket: true },
                },
              },
              { id: { terms: { field: 'id' } } },
            ],
          },
        },
      },
    };

    if (
      after_key !== undefined &&
      !isEmptyObject(after_key)
    ) {
      payload.aggs.unique_subjects.composite.after = after_key;
    }

    if (filters?.['filterPersonTypes']?.length > 0) {
      payload.query.bool.must.push({ bool: { should: [] } });
      filters['filterPersonTypes'].forEach((element: any) => {
        payload.query.bool.must[
          payload.query.bool.must.length - 1
        ].bool.should.push({ term: { 'type.keyword': String(element.name) } });
      });
    }

    // Add date range filter.
    if (filters.filterYearMax && filters.filterYearMin) {
      payload.query.bool.must.push({
        range: {
          date_born_date: {
            gte: ('0000' + String(filters.filterYearMin)).slice(-4) + '-01-01',
            lte: ('0000' + String(filters.filterYearMax)).slice(-4) + '-12-31',
          },
        },
      });
    }

    // Search for first character of name
    if (
      searchText &&
      String(searchText).length === 1
    ) {
      payload.query.bool.must.push({
        regexp: {
          'sort_by_name.keyword': {
            value: `${String(searchText)}.*|${String(
              searchText
            ).toLowerCase()}.*`,
          },
        },
      });
    } else if (searchText) {
      // Substring search in full person name
      payload.query.bool.must.push({
        wildcard: {
          full_name: {
            value: `*${String(searchText)}*`,
            case_insensitive: true,
          },
        },
      });
    }

    return this.http.post<any>(this.getElasticSearchUrl(this.elasticSubjectIndex), payload);
  }

  /**
   * Get details of all places from ElasticSearch.
   * @param after_key key of last record of previous fetch (used for "pagination")
   * @param searchText to apply to place names
   * @param filters to apply to the query
   * @param max number of records to retrieve
   */
  getPlacesFromElastic(after_key?: any, searchText?: string, filters?: any, max?: number) {
    const showPublishedStatus = config.page?.index?.places?.publishedStatus ?? 2;

    if (filters === null || filters === undefined) {
      filters = {};
    }

    if (max === undefined || max === null) {
      max = 500;
    } else if (max > 10000) {
      max = 10000;
    }

    const payload: any = {
      size: 0,
      query: {
        bool: {
          must: [
            {
              term: {
                project_id: { value: config.app.projectId },
              },
            },
            { term: { published: { value: showPublishedStatus } } },
            { term: { loc_deleted: { value: 0 } } },
            { term: { ev_c_deleted: { value: 0 } } },
            { term: { ev_o_deleted: { value: 0 } } },
            { term: { publication_deleted: { value: 0 } } },
          ],
        },
      },
      aggs: {
        unique_places: {
          composite: {
            size: max,
            sources: [
              {
                sort_by_name: {
                  terms: {
                    field: 'sort_by_name.keyword',
                    missing_bucket: true,
                  },
                },
              },
              { name: { terms: { field: 'name.keyword' } } },
              { id: { terms: { field: 'id' } } },
              { loc_id: { terms: { field: 'loc_id' } } },
            ],
          },
        },
      },
    };

    if (
      after_key !== undefined &&
      !isEmptyObject(after_key)
    ) {
      payload.aggs.unique_places.composite.after = after_key;
    }

    if (filters?.['filterPlaceCountries']?.length > 0) {
      payload.query.bool.must.push({ bool: { should: [] } });
      filters['filterPlaceCountries'].forEach((element: any) => {
        payload.query.bool.must[
          payload.query.bool.must.length - 1
        ].bool.should.push({
          term: { 'country.keyword': String(element.name) },
        });
      });
    }

    if (
      searchText &&
      String(searchText).length === 1
    ) {
      // Search for first character of place name
      payload.query.bool.must.push({
        regexp: {
          'sort_by_name.keyword': {
            value: `${String(searchText)}.*|${String(
              searchText
            ).toLowerCase()}.*`,
          },
        },
      });
    } else if (searchText) {
      // Substring search in full place name
      payload.query.bool.must.push({
        wildcard: {
          name: {
            value: `*${String(searchText)}*`,
            case_insensitive: true,
          },
        },
      });
    }

    return this.http.post<any>(this.getElasticSearchUrl(this.elasticLocationIndex), payload);
  }

  /**
   * Get details of all works from ElasticSearch.
   * @param from (used for pagination)
   * @param searchText to apply to person names
   * @param size number of records to retrieve
   */
  getWorksFromElastic(from: number, searchText?: string, size: number = 500) {
    const payload: any = {
      from: from,
      size: size,
      sort: [{ 'author_data.last_name.keyword': 'asc' }],
      query: {
        bool: {
          should: [
            {
              bool: {
                must: [
                  {
                    term: {
                      project_id: config.app.projectId,
                    },
                  },
                  {
                    term: { deleted: 0 },
                  },
                ],
              },
            },
            {
              bool: {
                must: [
                  {
                    term: {
                      project_id: config.app.projectId,
                    },
                  },
                  {
                    term: { deleted: 0 },
                  },
                ],
              },
            },
          ],
        },
      },
    };
    if (searchText) {
      payload.from = 0;
      payload.size = 5000;
      // Substring search in the work title
      payload.query.bool.should[0].bool.must.push({
        wildcard: {
          title: {
            value: `*${String(searchText)}*`,
            case_insensitive: true,
          },
        },
      });
      // Substring search in author name starting from whole words
      payload.query.bool.should[1].bool.must.push({
        regexp: {
          'author_data.full_name': {
            value: `${String(searchText)}.*|${String(
              searchText
            ).toLowerCase()}.*`,
          },
        },
      });
    }
    return this.http.post<any>(this.getElasticSearchUrl(this.elasticWorkIndex), payload);
  }

  /**
   * Get filter options for named entity indices in ElasticSearch.
   * @param type plural form of named entity type name
   */
  getFilterOptionsFromElastic(type: string): Observable<any> {
    const fieldName = (type === 'keywords') ? 'tag_type.keyword'
          : (type === 'places') ? 'country.keyword'
          : 'type.keyword';
    
    const index = (type === 'keywords') ? this.elasticTagIndex
          : (type === 'places') ? this.elasticLocationIndex
          : this.elasticSubjectIndex;

    const payload: any = {
      size: 0,
      query: {
        bool: {
          must: [
            {
              term: { project_id: config.app.projectId },
            },
          ],
        },
      },
      aggs: {
        types: {
          terms: {
            field: fieldName,
          },
        },
      },
    };
    return this.http.post(this.getElasticSearchUrl(index), payload);
  }

  /**
   * Get ElasticSearch endpoint URL for a specific index.
   * @param index name of index
   */
  private getElasticSearchUrl(index: string): string {
    return (this.apiURL + '/search/elastic/' + index);
  }

}

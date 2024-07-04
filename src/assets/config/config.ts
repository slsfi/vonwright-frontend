type Config = { [key: string]: any }

export const config: Config = {
  app: {
    siteURLOrigin: "https://vonwright.sls.fi",
    projectNameDB: "vonwright",
    projectId: 6,
    backendBaseURL: "https://api.sls.fi/digitaledition",
    alternateFacsimileBaseURL: "",
    i18n: {
      languages: [
        { code: "sv", label: "Svenska", region: "FI" }
      ],
      defaultLanguage: "sv",
      multilingualCollectionTableOfContents: false,
      multilingualReadingTextLanguages: [],
      multilingualNamedEntityData: false
    },
    enableRouterLoadingBar: true,
    openGraphMetaTags: {
      enabled: true,
      image: {
        sv: {
          altText: "Svartvitt fotografi av Georg Henrik von Wright 1950",
          URL: "assets/images/home-page-banner.jpg"
        }
      }
    },
    prebuild: {
      sitemap: true,
      staticCollectionMenus: true
    },
    ssr: {
      collectionSideMenu: false
    }
  },
  collections: {
    addTEIClassNames: true,
    replaceImageAssetsPaths: true,
    enableLegacyIDs: false,
    enableMathJax: true,
    firstTextItem: {
      146: "146_11586", 225: "225_21793"
    },
    frontMatterPages: {
      cover: true,
      title: true,
      foreword: false,
      introduction: true
    },
    highlightSearchMatches: true,
    inlineIllustrations: [225],
    mediaCollectionMappings: { 225: 46 },
    order: [
      [146, 225]
    ]
  },
  ebooks: [],
  page: {
    about: {
      initialPageNode: "01"
    },
    elasticSearch: {
      enableFilters: true,
      enableSortOptions: false,
      filterGroupsOpenByDefault: ["Type", "Collection"],
      hitsPerPage: 15,
      indices: ["vonwright"],
      openReadingTextWithComments: false,
      textHighlightFragmentSize: 150,
      textHighlightType: "fvh",
      textTitleHighlightType: "fvh",
      typeFilterGroupOptions: ["est", "com", "inl", "tit"],
      fixedFilters: [
        {
          terms: {
            deleted: ["0"]
          }
        },
        {
          terms: {
            published: ["2"]
          }
        }
      ],
      additionalSourceFields: [],
      aggregations: {
        Type: {
          terms: {
            field: "text_type",
            size: 40,
            order: {_key: "asc"}
          }
        },
        Collection: {
          terms: {
            field: "publication_data.collection_name.keyword",
            size: 40,
            order: {_key: "asc"}
          }
        }
      }
    },
    foreword: {
      showURNButton: false,
      showViewOptionsButton: true
    },
    home: {
      bannerImage: {
        altTexts: {
          sv: "Svartvitt fotografi av Georg Henrik von Wright 1950"
        },
        intrinsicSize: {
          height: 713,
          width: 1920
        },
        orientationPortrait: false,
        alternateSources: [],
        URL: "assets/images/vonwright-home-banner.jpg"
      },
      portraitOrientationSettings: {
        imagePlacement: {
          onRight: false,
          squareCroppedVerticalOffset: "10%"
        },
        siteTitleOnImageOnSmallScreens: false
      },
      showContentGrid: false,
      showFooter: false,
      showSearchbar: false
    },
    index: {
      keywords: {
        maxFetchSize: 500,
        showFilter: true,
        publishedStatus: 2
      },
      persons: {
        database: "elastic",
        maxFetchSize: 500,
        showFilter: false,
        publishedStatus: 2
      },
      places: {
        maxFetchSize: 500,
        showFilter: false,
        publishedStatus: 2
      },
      works: {
        publishedStatus: 2
      }
    },
    introduction: {
      hasSeparateTOC: true,
      showTextDownloadButton: true,
      showURNButton: false,
      showViewOptionsButton: true,
      viewOptions: {
        personInfo: false,
        placeInfo: false,
        workInfo: false,
        paragraphNumbering: true,
        pageBreakEdition: false
      }
    },
    mediaCollection: {
      showURNButton: false
    },
    text: {
      defaultViews: ["readingtext", "comments"],
      defaultViewOptions: ["comments"],
      showTextDownloadButton: true,
      showURNButton: false,
      showViewOptionsButton: true,
      viewOptions: {
        comments: true,
        personInfo: true,
        placeInfo: true,
        emendations: true,
        normalisations: true,
        workInfo: true,
        abbreviations: false,
        paragraphNumbering: true,
        pageBreakOriginal: true,
        pageBreakEdition: false
      },
      viewTypes: {
        showAll: true,
        readingtext: true,
        comments: true,
        facsimiles: true,
        manuscripts: false,
        variants: false,
        illustrations: false,
        legend: false,
        metadata: false
      }
    },
    title: {
      loadContentFromMarkdown: false,
      showURNButton: false,
      showViewOptionsButton: true
    }
  },
  component: {
    collectionSideMenu: {
      sortableCollectionsAlphabetical: [],
      sortableCollectionsChronological: [],
      sortableCollectionsCategorical: [],
      categoricalSortingPrimaryKey: "",
      categoricalSortingSecondaryKey: ""
    },
    contentGrid: {
      includeEbooks: false,
      includeMediaCollection: false,
      mediaCollectionCoverURL: "",
      mediaCollectionCoverAltTexts: {
        sv: "Alt-text"
      },
      showTitles: true
    },
    epub: {
      showTOCButton: true,
      showURNButton: false,
      showViewOptionsButton: true
    },
    facsimiles: {
      imageQuality: 4,
      showTitle: false
    },
    mainSideMenu: {
      items: {
        home: false,
        about: true,
        ebooks: false,
        collections: true,
        mediaCollections: false,
        indexKeywords: true,
        indexPersons: true,
        indexPlaces: true,
        indexWorks: true
      }
    },
    manuscripts: {
      showTitle: true,
      showNormalizedToggle: true,
      showOpenLegendButton: true
    },
    topMenu: {
      showAboutButton: true,
      showContentButton: true,
      showElasticSearchButton: true,
      showURNButton: false,
      showLanguageButton: false,
      showSiteLogo: true,
      siteLogoDefaultImageURL: "assets/images/logo/SLS_logo_full_black_346x112.png",
      siteLogoMobileImageURL: "assets/images/logo/SLS_logo_symbol_black_112x112.png",
      siteLogoLinkURL: "https://www.sls.fi/",
      siteLogoDimensions: {
        default: {
          height: 56,
          width: 173
        },
        mobile: {
          height: 56,
          width: 56
        }
      }
    },
    variants: {
      showOpenLegendButton: true
    }
  },
  modal: {
    downloadTexts: {
      introductionFormats: {
        xml: true,
        html: false,
        xhtml: false,
        txt: false,
        print: true
      },
      readingTextFormats: {
        xml: true,
        html: false,
        xhtml: false,
        txt: false,
        print: true
      },
      commentsFormats: {
        xml: true,
        html: false,
        xhtml: false,
        txt: false,
        print: true
      },
      manuscriptsFormats: {
        xml: false,
        html: false,
        xhtml: false,
        txt: false,
        print: true
      }
    },
    fullscreenImageViewer: {
      imageQuality: 4
    },
    referenceData: {
      URNResolverURL: "https://urn.fi/",
    },
    namedEntity: {
      showAliasAndPrevLastName: false,
      showArticleData: false,
      showCityRegionCountry: true,
      showDescriptionLabel: false,
      showGalleryOccurrences: false,
      showMediaData: false,
      showOccupation: false,
      showOccurrences: true,
      showType: false,
      useSimpleWorkMetadata: false
    }
  }
}

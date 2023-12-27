type Config = { [key: string]: any }

export const config: Config = {
  app: {
    siteURLOrigin: "https://topelius.sls.fi",
    projectNameDB: "topelius",
    projectId: 10,
    backendBaseURL: "https://testa-vonwright.sls.fi:8000/digitaledition",
    alternateFacsimileBaseURL: "",
    i18n: {
      languages: [
        { code: "sv", label: "Svenska", region: "FI" },
        { code: "fi", label: "Suomi", region: "FI" }
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
          altText: "alt-text",
          URL: "assets/images/home-page-banner.jpg"
        },
        fi: {
          altText: "alt-teksti",
          URL: "assets/images/home-page-banner.jpg"
        }
      }
    }
  },
  collections: {
    addTEIClassNames: true,
    replaceImageAssetsPaths: true,
    enableLegacyIDs: true,
    enableMathJax: false,
    firstTextItem: {
      216: "216_20280", 219: "219_19443", 220: "220_20122",
      218: "218_20230_ch2", 210: "210_20548_ch1", 208: "208_18466_ch4",
      207: "207_18464_ch1", 214: "214_20240_ch1", 203: "203_20217_ch1",
      213: "213_18465_ch1", 202: "202_18467_ch1", 199: "199_18284",
      221: "221_21422", 206: "206_20212_ch1", 201: "201_18471",
      211: "211_20128", 200: "200_19870", 205: "205_20227_ch1",
      215: "215_20568", 217: "217_20559_ch1", 204: "204_20322",
      212: "212_20323", 209: "209_20479"
    },
    frontMatterPages: {
      cover: true,
      title: true,
      foreword: true,
      introduction: true
    },
    highlightSearchMatches: true,
    inlineIllustrations: [206],
    mediaCollectionMappings: { 214: 44, 206: 19, 218: 19 },
    order: [
      [216, 219, 220, 218, 210, 208, 207, 214, 203, 213,
        202, 199, 221, 206, 201, 211, 200, 205, 215, 217,
        204, 212, 209]
    ]
  },
  ebooks: [
    {
      title: "Bröd och bot",
      filename: "norrback-brod-och-bot.epub",
      externalFileURL: "",
      coverURL: "",
      downloadOptions: [
        {
          url: "https://www.sls.fi/sv/utgivning/historiska-recept",
          label: ""
        }
      ]
    },
    {
      title: "Marriage Conditions in a Palestinian Village I (epub)",
      filename: "marriage-conditions-1.epub",
      externalFileURL: "https://api.sls.fi/digitaledition/granqvist/files/30/epub/30_11672_Marriage_Conditions_1.epub/",
      coverURL: "",
      downloadOptions: [
        {
          url: "https://api.sls.fi/digitaledition/granqvist/files/30/epub/30_11672_Marriage_Conditions_1.epub/",
          label: "EPUB"
        },
        {
          url: "https://api.sls.fi/digitaledition/granqvist/files/30/pdf/30_11672_Marriage_Conditions_1.pdf/",
          label: "PDF"
        }
      ]
    },
    {
      title: "Marriage Conditions in a Palestinian Village I (pdf)",
      filename: "marriage-conditions-1.pdf",
      externalFileURL: "https://api.sls.fi/digitaledition/granqvist/files/30/pdf/30_11672_Marriage_Conditions_1.pdf/",
      coverURL: "",
      downloadOptions: [
        {
          url: "https://api.sls.fi/digitaledition/granqvist/files/30/epub/30_11672_Marriage_Conditions_1.epub/",
          label: "EPUB"
        },
        {
          url: "https://api.sls.fi/digitaledition/granqvist/files/30/pdf/30_11672_Marriage_Conditions_1.pdf/",
          label: "PDF"
        }
      ]
    }
  ],
  page: {
    about: {
      initialPageNode: "01-01"
    },
    elasticSearch: {
      enableFilters: true,
      enableSortOptions: true,
      filterGroupsOpenByDefault: ["Years", "Type", "Genre", "Collection"],
      hitsPerPage: 15,
      indices: ["topelius"],
      openReadingTextWithComments: false,
      textHighlightFragmentSize: 150,
      textHighlightType: "fvh",
      textTitleHighlightType: "fvh",
      typeFilterGroupOptions: ["est", "com", "var", "inl", "tit", "fore"],
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
        Years: {
          date_histogram: {
            field: "orig_date_sort",
            calendar_interval: "year",
            format: "yyyy"
          }
        },
        Type: {
          terms: {
            field: "text_type",
            size: 40,
            order: {_key: "asc"}
          }
        },
        Genre: {
          terms: {
            field: "publication_data.genre.keyword",
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
        },
        LetterSenderName: {
          terms: {
            field: "sender_subject_name.keyword",
            size: 100
          }
        },
        LetterReceiverName: {
          terms: {
            field: "receiver_subject_name.keyword",
            size: 100
          }
        },
        LetterSenderLocation: {
          terms: {
            field: "sender_location_name.keyword",
            size: 50
          }
        },
        LetterReceiverLocation: {
          terms: {
            field: "receiver_location_name.keyword",
            size: 50
          }
        }
      }
    },
    foreword: {
      showURNButton: true,
      showViewOptionsButton: true
    },
    home: {
      bannerImage: {
        altTexts: {
          sv: "Porträtt av Zacharias Topelius",
          fi: "Zacharias Topeliuksen muotokuva"
        },
        orientationPortrait: true,
        URL: "assets/images/home-page-banner-portrait.jpg"
      },
      portraitOrientationSettings: {
        imagePlacement: {
          onRight: false,
          squareCroppedVerticalOffset: "10%"
        },
        siteTitleOnImageOnSmallScreens: false
      },
      showContentGrid: false,
      showFooter: true,
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
        showFilter: true,
        publishedStatus: 2
      },
      places: {
        maxFetchSize: 500,
        showFilter: true,
        publishedStatus: 2
      },
      works: {
        publishedStatus: 2
      }
    },
    introduction: {
      hasSeparateTOC: true,
      showTextDownloadButton: true,
      showURNButton: true,
      showViewOptionsButton: true,
      viewOptions: {
        personInfo: true,
        placeInfo: false,
        workInfo: true,
        paragraphNumbering: true,
        pageBreakEdition: true
      }
    },
    mediaCollection: {
      showURNButton: true
    },
    text: {
      defaultViews: ["readingtext", "comments", "facsimiles"],
      defaultViewOptions: ["comments"],
      showTextDownloadButton: true,
      showURNButton: true,
      showViewOptionsButton: true,
      viewOptions: {
        comments: true,
        personInfo: true,
        placeInfo: true,
        emendations: true,
        normalisations: true,
        workInfo: true,
        abbreviations: true,
        paragraphNumbering: true,
        pageBreakOriginal: true,
        pageBreakEdition: true
      },
      viewTypes: {
        showAll: true,
        readingtext: true,
        comments: true,
        facsimiles: true,
        manuscripts: true,
        variants: true,
        illustrations: true,
        legend: true,
        metadata: false
      }
    },
    title: {
      loadContentFromMarkdown: false,
      showURNButton: true,
      showViewOptionsButton: true
    }
  },
  component: {
    collectionSideMenu: {
      sortableCollectionsAlphabetical: ["211", "215", "219", "220"],
      sortableCollectionsChronological: ["215", "219", "220"],
      sortableCollectionsCategorical: [],
      categoricalSortingPrimaryKey: "",
      categoricalSortingSecondaryKey: ""
    },
    contentGrid: {
      includeEbooks: false,
      includeMediaCollection: false,
      mediaCollectionCoverURL: "",
      mediaCollectionCoverAltTexts: {
        sv: "Alt-text",
        fi: "Alt-teksti"
      },
      showTitles: true
    },
    epub: {
      showTOCButton: true,
      showURNButton: true,
      showViewOptionsButton: true
    },
    facsimiles: {
      imageQuality: 4,
      showTitle: true
    },
    mainSideMenu: {
      items: {
        home: false,
        about: true,
        ebooks: true,
        collections: true,
        mediaCollections: true,
        indexKeywords: false,
        indexPersons: true,
        indexPlaces: true,
        indexWorks: false
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
      showLanguageButton: true,
      showSiteLogo: true,
      siteLogoDefaultImageURL: "assets/images/logo.svg",
      siteLogoMobileImageURL: "assets/images/logo-mobile.svg",
      siteLogoLinkURL: "https://www.sls.fi/"
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
      showCityRegionCountry: false,
      showDescriptionLabel: false,
      showGalleryOccurrences: false,
      showMediaData: false,
      showOccupation: false,
      showOccurrences: true,
      showType: false,
      useSimpleWorkMetadata: true
    }
  }
}

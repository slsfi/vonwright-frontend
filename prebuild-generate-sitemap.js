const fs = require('fs');
const path = require('path');
const common = require('./prebuild-common-fns');

const configFilepath = 'src/assets/config/config.ts';
const sitemapFilename = 'sitemap.txt';

generateSitemap();


/**
 * Generates a simple sitemap text file in the root folder `src/`.
 * The file contains one URL per line. The script uses the settings
 * in config.ts to fetch data about the project and generate the
 * URLs to all unique pages. The following page types are included:
 * - Home
 * - About
 * - Ebook
 * - Collection
 * - Media collection
 * Because the sitemap is a plain text file, only the URLs to pages
 * in the default language are generated.
 */
async function generateSitemap() {
  const config = common.getConfig(configFilepath);
  const generateSitemap = config.app?.prebuild?.sitemap ?? true;
  
  if (generateSitemap) {
    console.log('Generating sitemap ...');
  } else {
    console.log('Skipping generation of sitemap, disabled in config.\n');
    return;
  }

  const projectName = config.app?.projectNameDB ?? '';
  const API = config.app?.backendBaseURL ?? '';
  let urlOrigin = config.app?.siteURLOrigin ?? '';

  if (!projectName || !API || !urlOrigin) {
    console.error('Critical config values are missing, cannot generate sitemap.');
    process.exit(1); // Hard failure: something is wrong with core config
  }

  const locale = config.app?.i18n?.defaultLanguage ?? 'sv';
  const multilingualCollectionTOC = config.app?.i18n?.multilingualCollectionTableOfContents ?? false;

  const APIBase = API + '/' + projectName;
  if (urlOrigin.length && urlOrigin[urlOrigin.length - 1] === '/') {
    // remove trailing slash from url origin
    urlOrigin = urlOrigin.slice(0, -1);
  }

  let urlCounter = 0;

  // Initialize sitemap file (adds home page URL to it)
  let success = initializeSitemapFile(urlOrigin, locale);
  if (!success) {
    console.log('Error: unable to initialize sitemap file.');
    return;
  } else {
    urlCounter += 1;
  }

  // Get about-pages URLs
  if (config.component?.mainSideMenu?.items?.about) {
    let aboutPages = await common.fetchWithRetry(APIBase + '/static-pages-toc/' + locale);
    if (aboutPages && aboutPages.children) {
      urlCounter += generateAboutPagesURLs(aboutPages.children, '03', urlOrigin, locale);
    }
  }

  // Get article-pages URLs
  if (config.component?.mainSideMenu?.items?.articles && config.articles?.length) {
    urlCounter += generateArticleURLs(config.articles, urlOrigin, locale);
  }

  // Get ebook URLs
  if (config.component?.mainSideMenu?.items?.ebooks && config.ebooks?.length) {
    urlCounter += generateEbookURLs(config.ebooks, urlOrigin, locale);
  }

  // Get collection URLs
  if (config.collections?.order?.length) {
    let collectionsEndpoint = APIBase + '/collections';
    if (multilingualCollectionTOC) {
      collectionsEndpoint += '/' + locale;
    }

    // Fetch all collections from the backend
    const allCollections = await common.fetchWithRetry(collectionsEndpoint);

    if (!allCollections) {
      console.warn(`Skipping collections: No data fetched from ${collectionsEndpoint}`);
    } else {
      const includedCollectionIds = config.collections.order.flat();
      // Filter out the collections that are not included according to the config
      const collections = allCollections.filter(coll => includedCollectionIds.includes(coll.id));

      if (collections) {
        const fmPages = ['cover', 'title', 'foreword', 'introduction']

        for (const fmPage of fmPages) {
          urlCounter += await generateCollectionURLs(collections, fmPage, urlOrigin, locale, config);
        }

        urlCounter += await generateCollectionURLs(collections, 'text', urlOrigin, locale, config, APIBase, multilingualCollectionTOC);
      }
    }
  }

  // Get media collection URLs
  if (config.component?.mainSideMenu?.items?.mediaCollections) {
    const mediaCollections = await common.fetchWithRetry(APIBase + '/gallery/data/' + locale);
    if (mediaCollections && mediaCollections.length) {
      urlCounter += await generateMediaCollectionURLs(mediaCollections, urlOrigin, locale);
    }
  }

  const summary = `Generated URLs: ${urlCounter}\n`;
  console.log(summary);
}

function initializeSitemapFile(urlOrigin, locale) {
  try {
    fs.writeFileSync(path.join(__dirname, 'src/' + sitemapFilename), urlOrigin + '/' + locale + '/\n');
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function appendToSitemapFile(content) {
  try {
    fs.appendFileSync(path.join(__dirname, 'src/' + sitemapFilename), content);
  } catch (err) {
    console.error(err);
  }
}

function generateAboutPagesURLs(aboutPages, mdFolderNumber, urlOrigin, locale) {
  for (let p = 0; p < aboutPages.length; p++) {
    if (aboutPages[p]['id'] === locale + '-' + mdFolderNumber) {
      aboutPages = aboutPages[p];
      break;
    }
  }
  let counter = 0;
  const aboutPagesList = common.flattenObjectTree(aboutPages, 'children', 'id');
  for (let z = 0; z < aboutPagesList.length; z++) {
    if (aboutPagesList[z]['type'] === 'file' && aboutPagesList[z]['id']) {
      const id = aboutPagesList[z]['id'].replace(locale + '-', '');
      const url = `${urlOrigin}/${locale}/about/${id}`;
      appendToSitemapFile(url + '\n');
      counter += 1;
    }
  }
  return counter;
}

function generateArticleURLs(articles, urlOrigin, locale) {
  let counter = 0;
  for (let i = 0; i < articles.length; i++) {
    if (articles[i]['language'] === locale) {
      const url = `${urlOrigin}/${locale}/article/${articles[i]['routeName']}`;
      appendToSitemapFile(url + '\n');
      counter += 1;
    }
  }
  return counter;
}

function generateEbookURLs(epubs, urlOrigin, locale) {
  let counter = 0;
  for (let i = 0; i < epubs.length; i++) {
    const filename = epubs[i]['filename'];
    const type = filename.substring(filename.lastIndexOf('.') + 1, filename.length) || '';
    const name = filename.substring(0, filename.length - type.length - 1) || '';
    if (!type || !name) {
      continue;
    }
    const url = `${urlOrigin}/${locale}/ebook/${type}/${name}`;
    appendToSitemapFile(url + '\n');
    counter += 1;
  }
  return counter;
}

async function generateCollectionURLs(collections, part, urlOrigin, locale, config, API = undefined, multilingualTOC = false) {
  let counter = 0;
  for (let i = 0; i < collections.length; i++) {
    if (part === 'text') {
      if (i > 0 && (i % 10 === 0)) {
        // Pause every 10th collection to avoid backend overload
        await common.sleep(2000);
      }
      counter += await generateCollectionTextURLs(collections[i]['id'] || 0, urlOrigin, locale, API, multilingualTOC);
    } else if (common.enableFrontMatterPage(part, collections[i]['id'], config)) {
      const url = `${urlOrigin}/${locale}/collection/${collections[i]['id']}/${part}`;
      appendToSitemapFile(url + '\n');
      counter += 1;
    }
  }
  return counter;
}

async function generateCollectionTextURLs(collection_id, urlOrigin, locale, API, multilingualTOC) {
  let endpoint = API + '/toc/' + collection_id;
  if (multilingualTOC) {
    endpoint += '/' + locale;
  }

  const tocJSON = await common.fetchWithRetry(endpoint);

  // Handle failed fetch
  if (!tocJSON) {
    console.warn(`Skipping collection ${collection_id}: No Table of Contents fetched from ${endpoint}`);
    return 0;
  }

  // Flatten the TOC structure
  const toc = common.flattenObjectTree(tocJSON, 'children', 'itemId');
  if (!toc || !toc.length) {
    console.warn(`No items found in TOC for collection ${collection_id}`);
    return 0;
  }

  let counter = 0;
  const addedUrls = new Set(); // use a Set to automatically prevent duplicates

  for (let i = 0; i < toc.length; i++) {
    const itemId = toc[i]?.itemId?.split(';')[0];
    if (!itemId) continue;

    const prevItemId = toc[i - 1]?.itemId?.split(';')[0];
    if (itemId === prevItemId) continue;

    const parts = itemId.split('_');
    if (parts.length > 1) {
      const textId = parts[1];
      const chapterId = parts[2] || '';

      let url = `${urlOrigin}/${locale}/collection/${collection_id}/text/${textId}`;
      if (chapterId) url += `/${chapterId}`;

      if (!addedUrls.has(url)) {
        appendToSitemapFile(url + '\n');
        addedUrls.add(url);
        counter++;
      }
    }
  }

  return counter;
}

async function generateMediaCollectionURLs(mediaCollections, urlOrigin, locale) {
  let counter = 1;
  appendToSitemapFile(`${urlOrigin}/${locale}/media-collection` + '\n');

  for (let i = 0; i < mediaCollections.length; i++) {
    const url = `${urlOrigin}/${locale}/media-collection/${mediaCollections[i]['id']}`;
    appendToSitemapFile(url + '\n');
    counter += 1;
  }

  return counter;
}

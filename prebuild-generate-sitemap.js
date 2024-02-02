const fs = require('fs');
const path = require('path');
const common = require('./prebuild-common-fns');

const configFilepath = 'src/assets/config/config.ts';
const sitemapFilename = 'sitemap.txt';

generateSitemap();


async function generateSitemap() {
  console.log('Generating sitemap ...');
  const config = common.getConfig(configFilepath);

  const projectName = config.app?.projectNameDB ?? '';
  const API = config.app?.backendBaseURL ?? '';
  let urlOrigin = config.app?.siteURLOrigin ?? '';
  const locale = config.app?.i18n?.defaultLanguage ?? 'sv';
  const multilingualCollectionTOC = config.app?.i18n?.multilingualCollectionTableOfContents ?? false;
  const collectionCovers = config.collections?.frontMatterPages?.cover ?? false;
  const collectionTitles = config.collections?.frontMatterPages?.title ?? false;
  const collectionForewords = config.collections?.frontMatterPages?.foreword ?? false;
  const collectionIntros = config.collections?.frontMatterPages?.introduction ?? false;

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
    let aboutPages = await common.fetchFromAPI(APIBase + '/static-pages-toc/' + locale);
    if (aboutPages && aboutPages.children) {
      urlCounter += generateAboutPagesURLs(aboutPages.children, '03', urlOrigin, locale);
    }
  }

  // Get ebook-pages URLs
  if (config.component?.mainSideMenu?.items?.ebooks && config.ebooks?.length) {
    urlCounter += generateEbookURLs(config.ebooks, urlOrigin, locale);
  }

  // Get collections URLs
  if (config.collections?.order?.length) {
    let collectionsEndpoint = APIBase + '/collections';
    if (multilingualCollectionTOC) {
      collectionsEndpoint += '/' + locale;
    }
    const collections = await common.fetchFromAPI(collectionsEndpoint);
    if (collections) {
      if (collectionCovers) {
        urlCounter += await generateCollectionURLs(collections, 'cover', urlOrigin, locale);
      }
      if (collectionTitles) {
        urlCounter += await generateCollectionURLs(collections, 'title', urlOrigin, locale);
      }
      if (collectionForewords) {
        urlCounter += await generateCollectionURLs(collections, 'foreword', urlOrigin, locale);
      }
      if (collectionIntros) {
        urlCounter += await generateCollectionURLs(collections, 'introduction', urlOrigin, locale);
      }

      urlCounter += await generateCollectionURLs(collections, 'text', urlOrigin, locale, APIBase, multilingualCollectionTOC);
    }
  }

  if (config.component?.mainSideMenu?.items?.mediaCollections) {
    const mediaCollections = await common.fetchFromAPI(APIBase + '/gallery/data/' + locale);
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

function generateEbookURLs(epubs, urlOrigin, locale) {
  let counter = 0;
  for (let i = 0; i < epubs.length; i++) {
    const url = `${urlOrigin}/${locale}/ebook/${epubs[i]['filename']}`;
    appendToSitemapFile(url + '\n');
    counter += 1;
  }
  return counter;
}

async function generateCollectionURLs(collections, part, urlOrigin, locale, API = undefined, multilingualTOC = false) {
  let counter = 0;
  for (let i = 0; i < collections.length; i++) {
    if (part === 'text') {
      counter += await generateCollectionTextURLs(collections[i]['id'] || 0, urlOrigin, locale, API, multilingualTOC);
    } else {
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
  const tocJSON = await common.fetchFromAPI(endpoint);
  const toc = common.flattenObjectTree(tocJSON, 'children', 'itemId');

  let counter = 0;
  let addedUrls = [];

  for (let i = 0; i < toc.length; i++) {
    if (toc[i]['itemId']) {
      const itemId = toc[i]['itemId'].split(';')[0];
      let prevItemId = undefined;
      if (i > 0 && toc[i - 1]['itemId']) {
        prevItemId = toc[i - 1]['itemId'].split(';')[0];
      }

      if (itemId !== prevItemId) {
        const itemIdParts = itemId.split('_');
        if (itemIdParts.length > 1) {
          const textId = itemIdParts[1];
          const chapterId = itemIdParts[2] || '';

          let url = `${urlOrigin}/${locale}/collection/${collection_id}/text/${textId}`;
          if (chapterId) {
            url += '/' + chapterId;
          }

          let newUrl = true;
          for (let x = 0; x < addedUrls.length; x++) {
            if (url === addedUrls[x]) {
              newUrl = false;
              break;
            }
          }
          if (newUrl) {
            addedUrls.push(url);
            appendToSitemapFile(url + '\n');
            counter++;
          }
        }
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

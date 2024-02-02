const fs = require('fs');
const path = require('path');

function getConfig(configFilepath) {
  // Join the relative file path with the current working directory to create an absolute path
  const absoluteConfigFilepath = path.join(__dirname, configFilepath);
  let config = null;

  try {
    // Read the contents of the config.ts file
    const configTS = fs.readFileSync(absoluteConfigFilepath, 'utf-8');

    // Extract the config object from the string
    let configContent = configTS.split('export const config')[1] || '';
    if (!configContent) {
      console.error('Unable to read config.ts file.');
      return null;
    }
    const c_start = configContent.indexOf('{');
    const c_end = configContent.lastIndexOf('}') + 1;
    configContent = 'module.exports = ' + configContent.slice(c_start, c_end);

    // Write the config object to a temporary file
    fs.writeFileSync(path.join(__dirname, 'src/tmp_config.js'), configContent);

    // Import the config object from the temporary file as javascript
    config = require(path.join(__dirname, 'src/tmp_config.js'));
  } catch (err) {
    console.error(err);
    return null;
  }

  try {
    // Delete the temporary config file
    fs.unlinkSync(path.join(__dirname, 'src/tmp_config.js'));
  } catch (e) {
    console.error(e);
  }
  return config;
}

async function fetchFromAPI(endpoint) {
  const res = await fetch(endpoint);
  if (res.ok) {
    return await res.json();
  } else {
    console.error(res);
    return null;
  }
}

function flattenObjectTree(data, branchingKey = 'children', requiredKey = undefined) {
  const dataWithoutChildren = (({ [branchingKey]: _, ...d }) => d)(data);
  let list = [];
  if (!requiredKey || (requiredKey && data[requiredKey])) {
    list = [dataWithoutChildren];
  }
  if (!data[branchingKey] && (!requiredKey || (requiredKey && data[requiredKey]))) {
    return list;
  }
  if (data[branchingKey] && data[branchingKey].length) {
    for (const child of data[branchingKey]) {
      list = list.concat(flattenObjectTree(child, branchingKey, requiredKey));
    }
  }
  return list;
}

function getTranslation(folderPath, locale, id) {
  if (!id) {
    return 'link';
  }
  // Join the relative file path with the current working directory to create an absolute path
  const absoluteFilepath = path.join(__dirname, folderPath + 'messages.' + locale + '.xlf');

  try {
    // Read the contents of the .xlf file
    const xlf = fs.readFileSync(absoluteFilepath, 'utf-8');

    let start = xlf.indexOf('<unit id="' + id + '">');
    if (start < 0) {
      return 'link';
    }
    start = xlf.indexOf('<target>', start);
    if (start < 0) {
      return 'link';
    } else {
      start += 8;
    }
    const end = xlf.indexOf('</target>', start);
    if (end > -1) {
      return xlf.slice(start, end);
    }
    return 'link';
  } catch (err) {
    console.error(err);
    return 'link';
  }
}

module.exports = {
  getConfig,
  fetchFromAPI,
  flattenObjectTree,
  getTranslation
};

const express = require("express");
const path = require("path");

// * Define language codes of all languages the app is available in.
// * A translated server will be started for each of these.
// * The first language in the array is treated as default for the app.
const languages = ["sv", "fi"];

const getTranslatedServer = (lang) => {
  const distFolder = path.join(
    process.cwd(),
    `dist/app/server/${lang}`
  );
  const server = require(`${distFolder}/main.js`);
  return server.app(lang);
};

function run() {
  const port = process.env['PORT'] || 4201;
  const translatedServers = {};

  // Start up the Node server in each language.

  languages.forEach(langCode => {
    translatedServers[langCode] = getTranslatedServer(langCode);
  });

  const server = express();

  for (const [langCode, langServer] of Object.entries(translatedServers)) {
    server.use(`/${langCode}`, langServer);
  }

  // Use default language server if no language code defined in route.
  server.use("", translatedServers[languages[0]]);

  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();

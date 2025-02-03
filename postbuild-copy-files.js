/**
 * This is a post-build script used to copy the `proxy-server.js`
 * file into the built application in the `dist/app` folder.
 * If the file already exists, it will be overwritten.
 */
const fs = require('fs');
const path = require('path');

// Define source and destination paths
const sourcePath = path.join(__dirname, 'proxy-server.js');
const destinationDir = path.join(__dirname, 'dist/app');
const destinationPath = path.join(destinationDir, 'proxy-server.js');

try {
  // Check if destination directory exists
  if (!fs.existsSync(destinationDir)) {
    console.error(`Post-build file copy: Destination folder ${destinationDir} does not exist. Skipping file copy.`);
    process.exit(1); // Exit with a non-zero code to indicate an issue
  }

  // Copy the file
  fs.copyFileSync(sourcePath, destinationPath);
  console.log(`Post-build file copy: File successfully copied.`);
} catch (error) {
  console.error('Post-build file copy: Error copying file.', error);
  process.exit(1); // Exit with a non-zero code to indicate an issue
}

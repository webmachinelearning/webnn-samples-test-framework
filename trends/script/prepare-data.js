const fs = require("fs");
const path = require("path");
const os = require("os");

const hostname = os.hostname();
const sourceDir = path.join(__dirname, `../../out/`);
const destinationDir = path.join(__dirname, `../data/${hostname}/`);

// Create the destination directory if it does not exist
if (!fs.existsSync(destinationDir)) {
  fs.mkdirSync(destinationDir, { recursive: true });
}

if (!fs.existsSync(sourceDir)) {
  console.warn(`The directory ${sourceDir} does not exist.`);
  return;
}

fs.readdir(sourceDir, (err, dates) => {
  if (err || dates.length === 0) {
    console.warn(`No results found in source directory ${sourceDir}.`);
    return;
  }

  dates.forEach((dateDir) => {
    const datePath = path.join(sourceDir, dateDir);
    if (fs.statSync(datePath).isDirectory()) {
      fs.readdir(datePath, (err, files) => {
        if (err) {
          console.error(`Error reading date directory ${dateDir}: ${err}`);
          return;
        }

        // Find the latest file for the current date directory
        files = files.filter((file) => path.extname(file) === ".json");
        let latestFile = files.reduce((latest, file) => {
          const filePath = path.join(datePath, file);
          const fileStat = fs.statSync(filePath);
          if (!latest || fileStat.mtime > latest.mtime) {
            return { file, mtime: fileStat.mtime };
          }
          return latest;
        }, null);

        if (latestFile) {
          const sourceFile = path.join(datePath, latestFile.file);
          const newFileName = latestFile.file.substring(0, 8) + ".json";
          const destinationFile = path.join(destinationDir, newFileName);

          fs.copyFile(sourceFile, destinationFile, (err) => {
            if (err) {
              console.error(`Error copying file ${latestFile.file}: ${err}`);
            } else {
              console.log(`Copied ${latestFile.file} to ${destinationDir}`);
            }
          });
        }
      });
    }
  });
});

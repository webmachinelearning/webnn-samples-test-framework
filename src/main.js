const fs = require("fs");
const path = require("path");

const _ = require("lodash");

const env = require("../env.json");
const util = require("./utils/util.js");
const { renderResultsAsHTML, report, scpUpload } = require("./utils/report.js");
const { program } = require("commander");

const parseFilter = (filter) => {
  const regexPattern =
    /^(samples|developer-preview)-([a-zA-Z0-9-]+)-(cpu|gpu|npu)(?:-(fp16|fp32|_))?(?:-([a-zA-Z0-9_]+|_))?$/;
  const match = filter.match(regexPattern);
  if (!match) {
    return null;
  }

  const [, source, sampleName, backend, dataType, model] = match;
  return { sampleName, source, backend, dataType, model };
};

const executeTestModule = async ({ config, sampleName, source, backend, dataType, model, results }) => {
  try {
    const testModule = require(`./cases/${source}/${sampleName}.js`);
    const resultsSamples = await testModule({ config, backend, dataType, model });
    _.merge(results[source], resultsSamples);
  } catch (error) {
    console.error(`Error occurred when testing '${sampleName}':`, error.message);
  } finally {
    // kill browser after each sample test execution to ensure the memory is freed
    util.killBrowserProcess(config);
  }
};

program
  .name("npm test --")
  .description("WebNN Sample Test")
  .option("-c --config <path>", "Specify the config file path", "config.json")
  .option("-f, --filters [filter...]", "Specify the specific single sample test")
  .option("-b --browser-dir <path>", "Specify browser 'Application' folder path")
  .option("-d --user-data-dir <path>", "Specify browser 'User Data' folder path");

program.action(async ({ config: configPath, filters, browserDir, userDataDir }) => {
  try {
    const config = require(path.resolve(process.cwd(), configPath));

    if (filters === true) {
      console.log("Available filters:");
      console.table(util.generateSupportedSamplesArray(config));
      return;
    } else if (Array.isArray(filters)) {
      for (let i = 0; i < filters.length; i++) {
        const parsedFilter = parseFilter(filters[i]);
        if (!parsedFilter) {
          console.error(`Invalid filter: ${filters[i]}`);
          console.log("Available filters:");
          console.table(util.generateSupportedSamplesArray(config));
          return;
        }
        filters[i] = parsedFilter;
      }
    }

    config.browserAppPath = browserDir ?? config.browserAppPath;
    config.browserUserDataPath = userDataDir ?? config.browserUserDataPath;
    util.killBrowserProcess(config);

    const results = { deviceInfo: await util.getDeviceInfo(config) };
    if (filters) {
      for (const filter of filters) {
        results[filter.source] = {};
        await executeTestModule({ config, ...filter, results });
      }
    } else {
      for (const source of ["samples", "developer-preview"]) {
        results[source] = {};
        const samples = config?.[source];
        if (samples) {
          for (const sampleName of Object.keys(samples)) {
            await executeTestModule({ config, sampleName, source, results });
          }
        }
      }
    }

    const jsonPath = await util.saveJsonFile(results);
    // Copy the test results JSON file into `trends/data` in both `debug` and `production` modes.
    // In `debug` mode, the `jsonPath` includes `minute` information, which is unnecessary
    // for `trends` since it only compares and displays daily results.
    util.copyFile(jsonPath, path.join(__dirname, "..", "trends", "data", require("os").hostname()), {
      targetName: path.basename(jsonPath).substring(0, 8) + ".json"
    });

    const htmlPath = jsonPath.split(".")[0] + ".html";
    fs.writeFileSync(htmlPath, await renderResultsAsHTML(require(jsonPath)));
    console.log(`Test results have been saved to ${jsonPath} and ${htmlPath}`);

    if (env.env === "production") {
      await report(results);
      await scpUpload(jsonPath);
    }
  } catch (error) {
    console.error("Unexpected error during test execution:", error.message);
  }
});

program.parse();

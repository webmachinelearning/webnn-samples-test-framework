const fs = require("fs");
const path = require("path");

const _ = require("lodash");

const config = require("../config.json");
const env = require("../env.json");
const util = require("./utils/util.js");
const { renderResultsAsHTML, report, scpUpload } = require("./utils/report.js");

const parseFilter = (filter) => {
  const regexPattern =
    /^(samples|developer-preview)-([a-zA-Z0-9-]+)-(cpu|gpu|npu)(?:-(fp16|fp32|_))?(?:-([a-zA-Z0-9_]+|_))?$/;
  const match = filter.match(regexPattern);
  if (!match) {
    console.error("No match found for:", filter);
    return null;
  }

  const [, source, sampleName, backend, dataType, model] = match;
  return {
    sampleName,
    source,
    backend,
    dataType,
    model
  };
};

const executeTestModule = async (sampleName, source, backend, dataType, model, results) => {
  try {
    const testModule = require(`./cases/${source}/${sampleName}.js`);
    const resultsSamples = await testModule({ backend, dataType, model });
    _.merge(results[source], resultsSamples);
  } catch (error) {
    console.error(`Error occurred when testing '${sampleName}':`, error.message);
  } finally {
    // kill browser after each sample test execution to ensure the memory is freed
    util.killBrowserProcess();
  }
};

const executeSampleTests = async (samples, source, results) => {
  if (!samples) return;
  results[source] = {};

  for (let sample of Object.keys(samples)) {
    await executeTestModule(sample, source, null, null, null, results);
  }
};

const main = async () => {
  try {
    const results = {};
    util.parseTestCliArgs(process.argv);
    const { filter } = util.cliArgs;

    util.killBrowserProcess();

    if (filter) {
      const parsedFilter = parseFilter(filter);
      if (!parsedFilter) return;

      results.deviceInfo = await util.getDeviceInfo();

      const { source, sampleName, backend, dataType, model } = parsedFilter;
      results[source] = {};
      await executeTestModule(sampleName, source, backend, dataType, model, results);
    } else {
      results.deviceInfo = await util.getDeviceInfo();

      const SAMPLES = config?.["samples"];
      const DEVELOPER_PREVIEW_DEMO = config?.["developer-preview"];

      await executeSampleTests(SAMPLES, "samples", results);
      await executeSampleTests(DEVELOPER_PREVIEW_DEMO, "developer-preview", results);
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
};

main();

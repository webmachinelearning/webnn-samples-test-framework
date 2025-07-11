const fs = require("fs");
const path = require("path");

const _ = require("lodash");

const config = require("../config.json");
const env = require("../env.json");
const util = require("./utils/util.js");
const { renderResultsAsHTML, report, scpUpload } = require("./utils/report.js");

const SAMPLES_NAME_JS_PATH_MAPPING = {
  imageClassification: __dirname + "/cases/samples/image-classification.js",
  fastStyleTransfer: __dirname + "/cases/samples/fast-style-transfer.js",
  objectDetection: __dirname + "/cases/samples/object-detection.js",
  codeEditor: __dirname + "/cases/samples/code-editor.js",
  notepad: __dirname + "/cases/samples/notepad.js",
  semanticSegmentation: __dirname + "/cases/samples/semantic-segmentation.js",
  faceRecognition: __dirname + "/cases/samples/face-recognition.js",
  facialLandmarkDetection: __dirname + "/cases/samples/facial-landmark-detection.js",
  handwrittenDigitsClassification: __dirname + "/cases/samples/handwritten-digits-classification.js",
  noiseSuppressionNsNet2: __dirname + "/cases/samples/noise-suppression-nsnet2.js",
  noiseSuppressionRnNoise: __dirname + "/cases/samples/noise-suppression-rnnoise.js",
  switchSampleTest: __dirname + "/cases/samples/switch-sample.js",
  switchBackendTest: __dirname + "/cases/samples/switch-backend.js"
};

const DEVELOPER_PREVIEW_NAME_JS_PATH_MAPPING = {
  stableDiffusion15: "./cases/developer-preview/stable-diffusion-1-5.js",
  stableDiffusionTurbo: "./cases/developer-preview/stable-diffusion-turbo.js",
  segmentAnything: "./cases/developer-preview/segment-anything.js",
  whisperBase: "./cases/developer-preview/whisper-base.js",
  imageClassification: "./cases/developer-preview/image-classification.js"
};

const parseFilter = (filter) => {
  const regexPattern =
    /^(samples|developerPreview)-([a-zA-Z0-9]+)-(cpu|gpu|npu)(?:-(fp16|fp32|_))?(?:-([a-zA-Z0-9_]+|_))?$/;
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
    const testFileRoot =
      source === "samples"
        ? SAMPLES_NAME_JS_PATH_MAPPING[sampleName]
        : DEVELOPER_PREVIEW_NAME_JS_PATH_MAPPING[sampleName];

    if (!testFileRoot) {
      console.warn(`Could not find execution script for '${sampleName}'.`);
      return;
    }

    const testModule = require(testFileRoot);
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

      await util.getConfig();
      results.deviceInfo = util.deviceInfo;

      const { source, sampleName, backend, dataType, model } = parsedFilter;
      results[source] = {};
      await executeTestModule(sampleName, source, backend, dataType, model, results);
    } else {
      await util.getConfig();
      results.deviceInfo = util.deviceInfo;

      const SAMPLES = config?.["samples"];
      const DEVELOPER_PREVIEW_DEMO = config?.["developerPreview"];

      await executeSampleTests(SAMPLES, "samples", results);
      await executeSampleTests(DEVELOPER_PREVIEW_DEMO, "developerPreview", results);
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
      await report(jsonPath);
      await scpUpload(jsonPath);
    }
  } catch (error) {
    console.error("Unexpected error during test execution:", error.message);
  }
};

main();

module.exports = SAMPLES_NAME_JS_PATH_MAPPING;

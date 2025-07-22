const util = require("../../utils/util.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");
const _ = require("lodash");
const config = require("../../../config.json");
const processInfo = require("../../utils/process.js");

async function stableDiffusion15Test({ backend, dataType, model } = {}) {
  let source = "developerPreview";
  let sample = "stableDiffusion15";
  let results = {};

  const pageElement = pageElementTotal[sample];
  const browserProcess = util.getBrowserProcess();

  const modelNameArray = ["textEncoder", "unet", "vaeDecoder", "safetyChecker"];

  const testExecution = async (backend, dataType, model = "") => {
    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);

    const screenshotFilename = model
      ? `${source}_${sample}_${backend}_${dataType}_${model}`
      : `${source}_${sample}_${backend}_${dataType}`;
    let errorMsg = "";
    let browser;
    let page;

    try {
      browser = await util.launchBrowser(config, backend);
      page = await browser.newPage();
      page.setDefaultTimeout(config["timeout"]);

      // navigate the page to a URL
      const urlArguments = config[source][sample]["urlArgs"][backend];
      await page.goto(`${config["developerPreviewBasicUrl"]}${config["developerPreviewUrl"][sample]}${urlArguments}`, {
        waitUntil: "networkidle0"
      });

      let rendererProcessInfo = processInfo.getRendererProcessInfo(browserProcess);
      _.set(
        results,
        [sample, backend, dataType, "privateMemoryRendererBefore"],
        rendererProcessInfo.PagedMemorySize64 ?? rendererProcessInfo.VmRSSKb ?? rendererProcessInfo.error
      );
      let gpuProcessInfo = processInfo.getGpuProcessInfo(browserProcess);
      _.set(
        results,
        [sample, backend, dataType, "privateMemoryGpuBefore"],
        gpuProcessInfo.PagedMemorySize64 ?? gpuProcessInfo.VmRSSKb ?? gpuProcessInfo.error
      );

      await Promise.race([
        (async () => {
          await util.waitForElementEnabled(page, pageElement["loadModelsButton"]);
          await page.click(pageElement["loadModelsButton"]);
          await util.waitForElementEnabled(page, pageElement["generateImageButton"]);
        })(),
        util.throwOnUncaughtException(page)
      ]);

      rendererProcessInfo = processInfo.getRendererProcessInfo(browserProcess);
      _.set(
        results,
        [sample, backend, dataType, "privateMemoryRendererAfter"],
        rendererProcessInfo.PagedMemorySize64 ?? rendererProcessInfo.VmRSSKb ?? rendererProcessInfo.error
      );
      _.set(
        results,
        [sample, backend, dataType, "privateMemoryRendererPeak"],
        rendererProcessInfo.PeakPagedMemorySize64 ?? rendererProcessInfo.VmHWMKb ?? rendererProcessInfo.error
      );

      gpuProcessInfo = processInfo.getGpuProcessInfo(browserProcess);
      _.set(
        results,
        [sample, backend, dataType, "privateMemoryGpuAfter"],
        gpuProcessInfo.PagedMemorySize64 ?? gpuProcessInfo.VmRSSKb ?? gpuProcessInfo.error
      );
      _.set(
        results,
        [sample, backend, dataType, "privateMemoryGpuPeak"],
        gpuProcessInfo.PeakPagedMemorySize64 ??
          gpuProcessInfo.peakMemory ??
          gpuProcessInfo.VmHWMKb ??
          gpuProcessInfo.error
      );

      for (let i = 0; i < config[source][sample]["rounds"]; i++) {
        await util.delay(1000);
        await Promise.race([
          (async () => {
            await page.click(pageElement["generateImageButton"]);
            // wait results
            await util.waitForElementEnabled(page, pageElement["generateImageButton"]);
          })(),
          util.throwOnUncaughtException(page)
        ]);
        // get results
        const textEncoderLoad = await page.$eval(pageElement["textEncoderLoad"], (el) => el.textContent);
        const textEncoderFetch = await page.$eval(pageElement["textEncoderFetch"], (el) => el.textContent);
        const textEncoderCreate = await page.$eval(pageElement["textEncoderCreate"], (el) => el.textContent);
        const textEncoderRun = await page.$eval(pageElement["textEncoderRun"], (el) => el.textContent);

        const unetLoad = await page.$eval(pageElement["unetLoad"], (el) => el.textContent);
        const unetFetch = await page.$eval(pageElement["unetFetch"], (el) => el.textContent);
        const unetCreate = await page.$eval(pageElement["unetCreate"], (el) => el.textContent);
        const unetRunRaw = await page.$eval(pageElement["unetRun"], (el) => el.innerHTML);
        const unetRun = unetRunRaw.split("<br>", 1)[0].split(" ");

        const vaeDecoderLoad = await page.$eval(pageElement["vaeDecoderLoad"], (el) => el.textContent);
        const vaeDecoderFetch = await page.$eval(pageElement["vaeDecoderFetch"], (el) => el.textContent);
        const vaeDecoderCreate = await page.$eval(pageElement["vaeDecoderCreate"], (el) => el.textContent);
        const vaeDecoderRun = await page.$eval(pageElement["vaeDecoderRun"], (el) => el.textContent);

        const safetyCheckerLoad = await page.$eval(pageElement["safetyCheckerLoad"], (el) => el.textContent);
        const safetyCheckerFetch = await page.$eval(pageElement["safetyCheckerFetch"], (el) => el.textContent);
        const safetyCheckerCreate = await page.$eval(pageElement["safetyCheckerCreate"], (el) => el.textContent);
        const safetyCheckerRun = await page.$eval(pageElement["safetyCheckerRun"], (el) => el.textContent);

        // set results
        let loadResults = {
          textEncoderLoad,
          textEncoderFetch,
          textEncoderCreate,
          unetLoad,
          unetFetch,
          unetCreate,
          vaeDecoderLoad,
          vaeDecoderFetch,
          vaeDecoderCreate,
          safetyCheckerLoad,
          safetyCheckerFetch,
          safetyCheckerCreate
        };
        let executionResults = {
          textEncoderRun,
          unetRun,
          vaeDecoderRun,
          safetyCheckerRun
        };

        Object.entries(executionResults).forEach(([_model, _value]) => {
          const modelName = _model.replace("Run", "");
          const pathArr = [sample, backend, dataType, modelName, "inferenceTime"];
          if (!model || model === modelName) {
            initializePath(pathArr);
            addValueToPath(pathArr, modelName === "unet" ? _value[0] : _value);

            // Unet results contains 20 iterations
            if (modelName === "unet") {
              // Calculate metrics
              const metrics = {
                average: util.calculateAverage(_value),
                median: util.getMedianValue(_value),
                best: util.getBestValue(_value)
              };

              // Store the metrics in resultsCI
              Object.entries(metrics).forEach(([key, value]) => {
                const path = [...pathArr.slice(0, -1), key];
                initializePath(path);
                addValueToPath(path, value);
              });
            }

            console.log(_value);
          }
        });
        console.log(`Load models results inferenceRound_${i}:`, loadResults);
        console.log(`Test Results inferenceRound_${i}: `, executionResults);
      }
    } catch (error) {
      errorMsg += error.message;
      if (page) {
        await util.saveScreenshot(page, screenshotFilename);
      }
    } finally {
      if (model) {
        _.set(results, [sample, backend, dataType, model, "error"], errorMsg.substring(0, config.errorMsgMaxLength));
      } else {
        for (let _model of modelNameArray) {
          _.set(results, [sample, backend, dataType, _model, "error"], errorMsg.substring(0, config.errorMsgMaxLength));
        }
      }
      if (browser) await browser.close();
    }
  };

  // Function to initialize the structure if it doesn't exist
  const initializePath = (pathArr) => {
    const result = _.get(results, pathArr, null);
    if (!result) {
      _.set(results, pathArr, []);
    }
  };

  // Function to add a value to the specified path
  const addValueToPath = (pathArr, value) => {
    const result = _.get(results, pathArr, null);
    if (Array.isArray(result)) {
      result.push(value);
      _.set(results, pathArr, result);
    }
  };

  if (backend && dataType && model) {
    await testExecution(backend, dataType, model);
  } else {
    for (let _backend in config[source][sample]) {
      if (!["cpu", "gpu", "npu"].includes(_backend)) {
        continue;
      }

      for (let _dataType in config[source][sample][_backend]) {
        await testExecution(_backend, _dataType);
      }
    }
  }

  return results;
}

module.exports = stableDiffusion15Test;

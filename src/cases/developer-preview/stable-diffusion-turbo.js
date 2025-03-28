const puppeteer = require("puppeteer");
const util = require("../../utils/util.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");
const _ = require("lodash");
const config = require("../../../config.json");
const processInfo = require("../../utils/process.js");

async function stableDiffusionTurboTest({ backend, dataType, model } = {}) {
  let source = "developerPreview";
  let sample = "stableDiffusionTurbo";
  let results = {};

  const pageElement = pageElementTotal[sample];
  const browserProcess = util.getBrowserProcess();
  const modelNameArray = ["textEncoder", "unet", "vaeDecoder", "safetyChecker"];

  const testExecution = async (backend, dataType, model = "") => {
    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);

    const screenshotFilename = model
      ? `${source}_${sample}_${backend}_${dataType}_${model}`
      : `${source}_${sample}_${backend}_${dataType}`;

    const args = util.getBrowserArgs(backend);
    const { browserPath, userDataDir } = util.getBrowserPath(config.browser);
    let errorMsg = "";
    let page;
    let browser;

    try {
      // launch the browser
      browser = await puppeteer.launch({
        headless: config.headless,
        defaultViewport: null,
        args,
        executablePath: browserPath,
        ignoreHTTPSErrors: true,
        protocolTimeout: config["timeout"],
        userDataDir
      });
      page = await browser.newPage();
      page.setDefaultTimeout(config["timeout"]);

      // navigate the page to a URL
      const urlArguments = config[source][sample]["urlArgs"][backend];
      await page.goto(`${config["developerPreviewBasicUrl"]}${config["developerPreviewUrl"][sample]}${urlArguments}`, {
        waitUntil: "networkidle0"
      });

      try {
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

        // wait for load_models_button enabled
        await util.waitForElementEnabled(page, pageElement["loadModelsButton"]);
        // click load_models_button
        await page.click(pageElement["loadModelsButton"]);
        // wait for generateImageButton enabled
        await util.waitForElementEnabled(page, pageElement["generateImageButton"]);

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
          gpuProcessInfo.PeakPagedMemorySize64 ?? gpuProcessInfo.VmHWMKb ?? gpuProcessInfo.error
        );
      } catch (error) {
        errorMsg += `[PageTimeout]`;
        throw error;
      }
      // loop test
      for (let i = 0; i < config[source][sample]["rounds"]; i++) {
        try {
          // wait for generate image button enabled
          await util.waitForElementEnabled(page, pageElement["generateImageButton"]);
          // click generate imag button
          await page.click(pageElement["generateImageButton"]);
          await util.delay(200);
          // wait results (image 4 show)
          await page.waitForFunction(
            (selector) => {
              const element = document.querySelector(selector);
              return element?.textContent.trim().match(/^\d+\.?\d*\s*ms$/);
            },
            {},
            pageElement["data4"]
          );
          let image4Time = await page.$eval(pageElement["data4"], (el) => el.textContent);
          let checkCount = 0;
          while (image4Time.includes("...")) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            image4Time = await page.$eval(pageElement["data4"], (el) => el.textContent);
            checkCount++;
            if (checkCount > 60) break;
          }
          await util.delay(1000);
        } catch (error) {
          errorMsg += `[PageTimeout]`;
          throw error;
        }

        // get results
        const textEncoderFetch = await page.$eval(pageElement["textEncoderFetch"], (el) => el.textContent);
        const textEncoderCreate = await page.$eval(pageElement["textEncoderCreate"], (el) => el.textContent);
        const unetFetch = await page.$eval(pageElement["unetFetch"], (el) => el.textContent);
        const unetCreate = await page.$eval(pageElement["unetCreate"], (el) => el.textContent);
        const vaeFetch = await page.$eval(pageElement["vaeFetch"], (el) => el.textContent);
        const vaeCreate = await page.$eval(pageElement["vaeCreate"], (el) => el.textContent);
        const scFetch = await page.$eval(pageElement["scFetch"], (el) => el.textContent);
        const scCreate = await page.$eval(pageElement["scCreate"], (el) => el.textContent);

        const loadResults = {
          textEncoderFetch,
          textEncoderCreate,
          unetFetch,
          unetCreate,
          vaeFetch,
          vaeCreate,
          scFetch,
          scCreate
        };

        const textEncoderRun1 = await page.$eval(pageElement["textEncoderRun1"], (el) => el.textContent);
        const unetRun1 = await page.$eval(pageElement["unetRun1"], (el) => el.textContent);
        const vaeRun1 = await page.$eval(pageElement["vaeRun1"], (el) => el.textContent);
        const runTotal1 = await page.$eval(pageElement["runTotal1"], (el) => el.textContent);
        const scRun1 = await page.$eval(pageElement["scRun1"], (el) => el.textContent);
        const executionImage1 = {
          textEncoderRun1,
          unetRun1,
          vaeRun1,
          runTotal1,
          scRun1
        };

        const textEncoderRun2 = await page.$eval(pageElement["textEncoderRun2"], (el) => el.textContent);
        const unetRun2 = await page.$eval(pageElement["unetRun2"], (el) => el.textContent);
        const vaeRun2 = await page.$eval(pageElement["vaeRun2"], (el) => el.textContent);
        const runTotal2 = await page.$eval(pageElement["runTotal2"], (el) => el.textContent);
        const scRun2 = await page.$eval(pageElement["scRun2"], (el) => el.textContent);
        const executionImage2 = {
          textEncoderRun2,
          unetRun2,
          vaeRun2,
          runTotal2,
          scRun2
        };

        const textEncoderRun3 = await page.$eval(pageElement["textEncoderRun3"], (el) => el.textContent);
        const unetRun3 = await page.$eval(pageElement["unetRun3"], (el) => el.textContent);
        const vaeRun3 = await page.$eval(pageElement["vaeRun3"], (el) => el.textContent);
        const runTotal3 = await page.$eval(pageElement["runTotal3"], (el) => el.textContent);
        const scRun3 = await page.$eval(pageElement["scRun3"], (el) => el.textContent);
        const executionImage3 = {
          textEncoderRun3,
          unetRun3,
          vaeRun3,
          runTotal3,
          scRun3
        };

        const textEncoderRun4 = await page.$eval(pageElement["textEncoderRun4"], (el) => el.textContent);
        const unetRun4 = await page.$eval(pageElement["unetRun4"], (el) => el.textContent);
        const vaeRun4 = await page.$eval(pageElement["vaeRun4"], (el) => el.textContent);
        const runTotal4 = await page.$eval(pageElement["runTotal4"], (el) => el.textContent);
        const scRun4 = await page.$eval(pageElement["scRun4"], (el) => el.textContent);
        const executionImage4 = {
          textEncoderRun4,
          unetRun4,
          vaeRun4,
          runTotal4,
          scRun4
        };

        // set results
        let executionResults = {
          executionImage1,
          executionImage2,
          executionImage3,
          executionImage4
        };

        // Initialize the reformatting result
        const modelsExecutionResults = {
          textEncoder: [],
          unet: [],
          vaeDecoder: [],
          safetyChecker: []
        };

        // Map the raw data to reformatted structure
        Object.entries(executionResults).forEach(([execution, data]) => {
          modelsExecutionResults["textEncoder"].push(data[`textEncoderRun${execution.slice(-1)}`]);
          modelsExecutionResults["unet"].push(data[`unetRun${execution.slice(-1)}`]);
          modelsExecutionResults["vaeDecoder"].push(data[`vaeRun${execution.slice(-1)}`]);
          modelsExecutionResults["safetyChecker"].push(data[`scRun${execution.slice(-1)}`]);
        });

        Object.entries(modelsExecutionResults).forEach(([_model, _value]) => {
          if (!model || model === _model) {
            const pathArr = [sample, backend, dataType, _model, "inferenceTime"];

            // Calculate metrics
            const metrics = {
              first: _value[0],
              average: util.calculateAverage(_value),
              median: util.getMedianValue(_value),
              best: util.getBestValue(_value)
            };

            Object.entries(metrics).forEach(([key, value]) => {
              const path = [...pathArr.slice(0, -1), key];
              initializePath(path);
              addValueToPath(path, value);
            });
          }
        });

        console.log(`Load models test results inferenceRound_${i}: `, loadResults);
        console.log(`Test results inferenceRound_${i}: `, executionResults);
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

module.exports = stableDiffusionTurboTest;

const util = require("../../utils/util.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");
const _ = require("lodash");
const processInfo = require("../../utils/process.js");

async function throwOnErrorLog(page) {
  await page.waitForFunction(
    (selector) => {
      for (let line of document.querySelector(selector).innerText.split("\n")) {
        if (line.includes("[Error]")) {
          throw Error(line.split("[Error]")[1].trim());
        }
      }
      return false;
    },
    {},
    "#log"
  );
}

async function stableDiffusionTurboTest({ config, backend, dataType, model } = {}) {
  let source = "developer-preview";
  let sample = "stable-diffusion-turbo";
  let results = {};
  const threshold = 75;

  const pageElement = pageElementTotal[sample];
  const browserProcess = util.getBrowserProcess(config);
  const modelNameArray = ["textEncoder", "unet", "vaeDecoder", "safetyChecker"];

  const testExecution = async (backend, dataType, model = "") => {
    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);

    const screenshotFilename = model
      ? `${source}_${sample}_${backend}_${dataType}_${model}`
      : `${source}_${sample}_${backend}_${dataType}`;

    let errorMsg = "";
    let page;
    let browser;

    try {
      browser = await util.launchBrowser(config);
      page = (await browser.pages())[0];
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
        gpuProcessInfo.PeakPagedMemorySize64 ?? gpuProcessInfo.VmHWMKb ?? gpuProcessInfo.error
      );

      // loop test
      for (let i = 0; i < config[source][sample]["rounds"]; i++) {
        await Promise.race([
          (async () => {
            await util.waitForElementEnabled(page, pageElement["generateImageButton"]);
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
              await util.delay(1000);
              image4Time = await page.$eval(pageElement["data4"], (el) => el.textContent);
              checkCount++;
              if (checkCount > 60) break;
            }
            await util.delay(1000);
          })(),
          throwOnErrorLog(page),
          util.throwOnUncaughtException(page)
        ]);

        // Verify similarity between generated images and template images
        // Treat as failure if any of the 4 generated images fall below the threshold
        for (let index = 0; index < 4; index++) {
          const canvasName = `stable-diffusion-turbo-generation-round${i}-${index}`;
          const { canvasPath } = await util.saveCanvasImage(page, pageElement[`imgCanvas${index}`], canvasName);

          const maxSimilarity = await util.checkImageGeneration(canvasPath);
          console.log(`The max similarity of this ${canvasName} is ${maxSimilarity}`);
          if (maxSimilarity < threshold) {
            throw new Error(
              `The generated image is significantly below expectations. Please review the image at: ${canvasPath}`
            );
          }
        }

        const loadResults = {};
        for (const model of modelNameArray) {
          for (const method of ["Fetch", "Create"]) {
            const key = model + method;
            loadResults[key] = await page.$eval(pageElement[key], (el) => el.textContent);
          }
          _.set(results, [sample, backend, dataType, model, "buildTime"], loadResults[model + "Create"]);
        }

        const executionResults = {
          textEncoder: [],
          unet: [],
          vaeDecoder: [],
          safetyChecker: []
        };

        for (const key of modelNameArray) {
          for (let i = 1; i <= 4; i++) {
            executionResults[key].push(await page.$eval(pageElement[`${key}Run${i}`], (el) => el.textContent));
          }
        }

        Object.entries(executionResults).forEach(([_model, _value]) => {
          if (!model || model === _model) {
            const pathArr = [sample, backend, dataType, _model, "inferenceTime"];

            // Calculate metrics
            const metrics = {
              first: Number(_value[0]).toFixed(2),
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

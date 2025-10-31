const util = require("../../utils/util.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");
const _ = require("lodash");
const processInfo = require("../../utils/process.js");

async function stableDiffusion15Test({ config, backend, dataType, model } = {}) {
  let source = "developer-preview";
  let sample = "stable-diffusion-1-5";
  let results = {};

  const pageElement = pageElementTotal[sample];
  const browserProcess = util.getBrowserProcess(config);

  const modelNameArray = ["textEncoder", "unet", "vaeDecoder", "safetyChecker"];

  const testExecution = async (backend, dataType, model = "") => {
    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);

    const screenshotFilename = model
      ? `${source}_${sample}_${backend}_${dataType}_${model}`
      : `${source}_${sample}_${backend}_${dataType}`;
    let browser;
    let page;

    try {
      config.timeout *= 3; // Compiling unet is extremely slow
      browser = await util.launchBrowser(config);
      page = (await browser.pages())[0];
      page.setDefaultTimeout(config.timeout);

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

      for (let i = 0; i < config[source][sample]["rounds"]; i++) {
        await util.delay(1000);
        await Promise.race([
          (async () => {
            await page.click(pageElement["generateImageButton"]);
            await util.waitForElementEnabled(page, pageElement["generateImageButton"]);
          })(),
          util.throwErrorOnElement(page, "#error"),
          util.throwOnUncaughtException(page)
        ]);
        for (const model of modelNameArray) {
          const modelKey = config[source][sample]["rounds"] > 1 ? `${model}-run-${i + 1}` : model;
          if (model === "unet") {
            _.set(
              results,
              [sample, backend, dataType, modelKey, "build"],
              await page.$eval(pageElement.unetCreate, (el) => el.textContent)
            );
            const unetRunRaw = await page.$eval(pageElement.unetRun, (el) => el.innerHTML);
            const unetRuns = unetRunRaw.split("<br>", 1)[0].split(" ").map(Number);
            _.set(results, [sample, backend, dataType, modelKey, "first"], unetRuns[0].toFixed(2));
            _.set(results, [sample, backend, dataType, modelKey, "average"], util.calculateAverage(unetRuns));
            _.set(results, [sample, backend, dataType, modelKey, "median"], util.getMedianValue(unetRuns));
            _.set(results, [sample, backend, dataType, modelKey, "best"], util.getBestValue(unetRuns));
          } else {
            _.set(
              results,
              [sample, backend, dataType, modelKey, "buildTime"],
              await page.$eval(pageElement[`${model}Create`], (el) => el.textContent)
            );
            _.set(
              results,
              [sample, backend, dataType, modelKey, "inferenceTime"],
              await page.$eval(pageElement[`${model}Run`], (el) => el.textContent)
            );
          }
        }
        console.log(results[sample][backend][dataType]);
      }
    } catch (error) {
      if (model) {
        _.set(
          results,
          [sample, backend, dataType, model, "error"],
          error.message.substring(0, config.errorMsgMaxLength)
        );
      } else {
        for (let _model of modelNameArray) {
          _.set(
            results,
            [sample, backend, dataType, _model, "error"],
            error.message.substring(0, config.errorMsgMaxLength)
          );
        }
      }
    } finally {
      if (page) {
        await util.saveScreenshot(page, screenshotFilename);
      }
      if (browser) {
        await browser.close();
      }
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

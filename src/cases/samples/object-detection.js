const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");
const path = require("path");
const config = require("../../../config.json");

async function objectDetectionTest({ backend, dataType, model } = {}) {
  const source = "samples";
  const sample = "object-detection";
  const results = {};

  const expectedCanvas = path.join(path.resolve(__dirname), "../../../assets/canvas");

  const testExecution = async (backend, dataType, model) => {
    if (!["cpu", "gpu", "npu"].includes(backend)) {
      console.warn(`Invalid backend: ${backend}`);
      return;
    }

    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);

    // set browser args, browser path
    const args = util.getBrowserArgs(backend);
    const { browserPath, userDataDir } = util.getBrowserPath(config.browser);
    const screenshotFilename = `${source}_${sample}_${backend}_${dataType}_${model}`;
    let errorMsg = "";
    let browser;
    let page;

    try {
      browser = await util.launchBrowser(config, backend);
      // open a new page
      page = await browser.newPage();
      // set the default timeout time for the page
      page.setDefaultTimeout(config["timeout"]);

      // navigate the page to a URL
      await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][sample]}`, {
        waitUntil: "networkidle0"
      });

      // wait for page text display
      await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
      // choose backend and model
      const elementsToClick = [pageElement[backend], pageElement[dataType], pageElement[model]];
      for (const selector of elementsToClick) {
        await util.clickElementIfEnabled(page, selector);
      }

      // wait for model running results
      await page.waitForSelector(pageElement["computeTime"], { visible: true });

      // save canvas image
      let compareImagesResults = 0;
      const canvasImageName = `${sample}_${dataType}_${model}`;
      const saveCanvasResult = await util.saveCanvasImage(page, pageElement.objectDetectionCanvas, canvasImageName);

      // compare canvas to expected canvas
      const expectedCanvasPath = `${expectedCanvas}/${sample}_${model}.png`;
      compareImagesResults = util.compareImages(saveCanvasResult.canvasPath, expectedCanvasPath);

      console.log("Compare images results with the template image:", compareImagesResults);

      if (compareImagesResults < 95) {
        errorMsg += "Image result is not the same as template, please check saved images.";
      }

      // get results
      const loadTime = await page.$eval(pageElement["loadTime"], (el) => el.textContent);
      const buildTime = await page.$eval(pageElement["buildTime"], (el) => el.textContent);
      const computeTime = await page.$eval(pageElement["computeTime"], (el) => el.textContent);

      // set results
      let pageResults = {
        loadTime: util.formatTimeResult(loadTime),
        buildTime: util.formatTimeResult(buildTime),
        inferenceTime: util.formatTimeResult(computeTime),
        compareImagesResults,
        error: errorMsg
      };

      pageResults = util.replaceEmptyData(pageResults);
      console.log("Test results: ", pageResults);

      _.set(results, [sample, backend, dataType, model, "buildTime"], pageResults.buildTime);
      _.set(results, [sample, backend, dataType, model, "inferenceTime"], pageResults.inferenceTime);

      await util.saveScreenshot(page, screenshotFilename);
    } catch (error) {
      errorMsg = error.message;
      if (page) {
        await util.saveScreenshot(page, screenshotFilename);
        errorMsg += await util.getAlertWarning(page, pageElement.alertWarning);
      }
      console.warn(errorMsg);
    } finally {
      _.set(results, [sample, backend, dataType, model, "error"], errorMsg.substring(0, config.errorMsgMaxLength));
      if (browser) await browser.close();
    }
  };
  // execute exact single sample with
  if (backend && dataType && model) {
    await testExecution(backend, dataType, model);
  } else {
    for (let _backend in config[source][sample]) {
      // only loop the valid backends objects
      if (!["cpu", "gpu", "npu"].includes(_backend)) {
        continue;
      }
      for (let _dataType in config[source][sample][_backend]) {
        for (let _model of config[source][sample][_backend][_dataType]) {
          await testExecution(_backend, _dataType, _model);
        }
      }
    }
  }
  return results;
}

module.exports = objectDetectionTest;

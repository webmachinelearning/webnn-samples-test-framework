const puppeteer = require("puppeteer");
const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");
const config = require("../../../config.json");

async function imageClassificationTest({ backend, dataType, model } = {}) {
  const source = "samples";
  const sample = "imageClassification";
  const results = {};

  const testExecution = async (backend, dataType, model) => {
    if (!["cpu", "gpu", "npu"].includes(backend)) {
      console.warn(`Invalid backend: ${backend}`);
      return;
    }

    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);
    const screenshotFilename = `${source}_${sample}_${backend}_${dataType}_${model}`;

    // set browser args, browser path
    const args = util.getBrowserArgs(backend);
    const { browserPath, userDataDir } = util.getBrowserPath(config.browser);
    let errorMsg = "";
    let browser;
    let page;

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

      await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][sample]}`, {
        waitUntil: "networkidle0"
      });

      await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
      const elementsToClick = [pageElement[backend], pageElement[dataType], pageElement[model]];

      for (const selector of elementsToClick) {
        await util.clickElementIfEnabled(page, selector);
      }

      // wait for model running results
      try {
        await page.waitForSelector(pageElement["computeTime"], {
          visible: true
        });
      } catch (error) {
        errorMsg += `[PageTimeout]`;
        throw error;
      }

      // get results
      const loadTime = await page.$eval(pageElement["loadTime"], (el) => el.textContent);
      const buildTime = await page.$eval(pageElement["buildTime"], (el) => el.textContent);
      const computeTime = await page.$eval(pageElement["computeTime"], (el) => el.textContent);

      const label0 = await page.$eval(pageElement["label0"], (el) => el.textContent);
      const prob0 = await page.$eval(pageElement["prob0"], (el) => el.textContent);
      const label1 = await page.$eval(pageElement["label1"], (el) => el.textContent);
      const prob1 = await page.$eval(pageElement["prob1"], (el) => el.textContent);
      const label2 = await page.$eval(pageElement["label2"], (el) => el.textContent);
      const prob2 = await page.$eval(pageElement["prob2"], (el) => el.textContent);

      // set results
      let pageResults = {
        loadTime: util.formatTimeResult(loadTime),
        buildTime: util.formatTimeResult(buildTime),
        inferenceTime: util.formatTimeResult(computeTime),
        labe0: label0,
        probability0: prob0,
        label1: label1,
        probability1: prob1,
        label2: label2,
        probability2: prob2,
        error: errorMsg
      };

      pageResults = util.replaceEmptyData(pageResults);
      console.log("Test Results: ", pageResults);

      _.set(results, [sample, backend, dataType, model, "inferenceTime"], pageResults.inferenceTime);
      await util.saveScreenshot(page, screenshotFilename);
    } catch (error) {
      errorMsg += error.message;
      if (page) {
        await util.saveScreenshot(page, screenshotFilename);
        errorMsg += await util.getAlertWarning(page, pageElement.alertWaring);
      }
      console.warn(errorMsg);
    } finally {
      _.set(results, [sample, backend, dataType, model, "error"], errorMsg.substring(0, config.errorMsgMaxLength));
      if (browser) await browser.close();
    }
  };

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

module.exports = imageClassificationTest;

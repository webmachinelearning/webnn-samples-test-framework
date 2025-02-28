const puppeteer = require("puppeteer");
const util = require("../../utils/util.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");
const _ = require("lodash");
const config = require("../../../config.json");

async function imageClassificationPreviewTest({ backend, dataType, model } = {}) {
  const source = "developerPreview";
  const sample = "imageClassification";
  let results = {};

  const pageElement = pageElementTotal[sample];

  const testExecution = async (backend, dataType, model) => {
    console.log(`${source} ${sample} ${backend} ${model} testing...`);
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

      const urlArguments = `${config[source][sample]["urlArgs"][backend]}${config[source][sample]["urlArgs"][model]}`;
      await page.goto(`${config["developerPreviewBasicUrl"]}${config["developerPreviewUrl"][sample]}${urlArguments}`, {
        waitUntil: "networkidle0"
      });

      try {
        // wait for the classifyButton enabled
        await util.waitForElementEnabled(page, pageElement["classifyButton"]);
        // click classifyButton
        await page.click(pageElement["classifyButton"]);
        // wait for the result show
        await page.waitForSelector(pageElement["result"], { visible: true });
      } catch (error) {
        error.message = `[PageTimeout]`;
        throw error;
      }
      // get results
      const median = await page.$eval(pageElement["median"], (el) => el.textContent);
      const first = await page.$eval(pageElement["first"], (el) => el.textContent);
      const best = await page.$eval(pageElement["best"], (el) => el.textContent);
      const average = await page.$eval(pageElement["average"], (el) => el.textContent);
      const throughput = (await page.$eval(pageElement["throughput"], (el) => el.textContent))
        .replace("FPS", "")
        .trim();

      const performanceResults = {
        median,
        first,
        best,
        average,
        throughput
      };
      const label1 = await page.$eval(pageElement["label1"], (el) => el.textContent);
      const score1 = await page.$eval(pageElement["score1"], (el) => el.textContent);
      const label2 = await page.$eval(pageElement["label2"], (el) => el.textContent);
      const score2 = await page.$eval(pageElement["score2"], (el) => el.textContent);
      const label3 = await page.$eval(pageElement["label3"], (el) => el.textContent);
      const score3 = await page.$eval(pageElement["score3"], (el) => el.textContent);
      const imageResults = {
        label1,
        score1,
        label2,
        score2,
        label3,
        score3
      };

      // set performance results
      Object.entries(performanceResults).forEach(([_metric, _value]) => {
        _.set(results, [sample, backend, dataType, model, _metric], _value);
      });

      // save screenshot
      await util.saveScreenshot(page, screenshotFilename);
      console.log("Test Results: ", performanceResults, imageResults);
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

module.exports = imageClassificationPreviewTest;

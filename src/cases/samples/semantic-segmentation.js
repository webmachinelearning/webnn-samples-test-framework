const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");

async function semanticSegmentationTest({ config, backend, dataType, model } = {}) {
  const source = "samples";
  const sample = "semantic-segmentation";
  let results = {};

  const testExecution = async (backend, dataType, model) => {
    if (!["cpu", "gpu", "npu"].includes(backend)) {
      console.warn(`Invalid backend: ${backend}`);
      return;
    }

    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);
    const screenshotFilename = `${source}_${sample}_${backend}_${dataType}_${model}`;
    let browser;
    let page;

    try {
      browser = await util.launchBrowser(config);
      page = (await browser.pages())[0];
      page.setDefaultTimeout(config["timeout"]);
      await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][sample]}`, {
        waitUntil: "networkidle0"
      });
      // wait for page text display
      await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
      // choose backend and model
      const elementsToClick = [pageElement[backend], pageElement[model]];
      for (const selector of elementsToClick) {
        await util.clickElementIfEnabled(page, selector);
      }

      // wait for model running results
      await Promise.race([
        page.waitForSelector(pageElement["computeTime"], { visible: true }),
        util.throwErrorOnElement(page, pageElement.alertWarning)
      ]);

      // get results
      const loadTime = await page.$eval(pageElement["loadTime"], (el) => el.textContent);
      const buildTime = await page.$eval(pageElement["buildTime"], (el) => el.textContent);
      const computeTime = await page.$eval(pageElement["computeTime"], (el) => el.textContent);

      // set results
      let pageResults = {
        loadTime: util.formatTimeResult(loadTime),
        buildTime: util.formatTimeResult(buildTime),
        inferenceTime: util.formatTimeResult(computeTime),
      };
      pageResults = util.replaceEmptyData(pageResults);
      _.set(results, [sample, backend, dataType, model, "buildTime"], pageResults.buildTime);
      _.set(results, [sample, backend, dataType, model, "inferenceTime"], pageResults.inferenceTime);

      console.log("Test Results: ", pageResults);
    } catch (error) {
      if (page) {
        await util.saveScreenshot(page, screenshotFilename);
      }
      console.warn(error.message);
      _.set(results, [sample, backend, dataType, model, "error"], error.message.substring(0, config.errorMsgMaxLength));
    } finally {
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

module.exports = semanticSegmentationTest;

const puppeteer = require("puppeteer");
const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");
const config = require("../../../config.json");

async function noiseSuppressionNsNet2Test({ backend, dataType, model } = {}) {
  const source = "samples";
  const sample = "noiseSuppressionNsNet2";
  const results = {};

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

  const testExecution = async (backend, dataType, model) => {
    if (!["cpu", "gpu", "npu"].includes(backend)) {
      console.warn(`Invalid backend: ${backend}`);
      return;
    }

    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);
    const args = util.getBrowserArgs(backend);
    const { browserPath, userDataDir } = util.getBrowserPath(config.browser);
    const screenshotFilename = `${source}_${sample}_${backend}_${dataType}_${model}`;

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

      // wait for page text display
      await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
      await util.clickElementIfEnabled(page, pageElement[backend]);

      try {
        await page.waitForSelector(`::-p-xpath(${pageElement.readyText})`, {
          visible: true
        });
      } catch (error) {
        errorMsg += `[PageTimeout]`;
        throw error;
      }

      for (let example of config[source][sample]["examples"]) {
        await page.click(pageElement["chooseAudioButton"]);
        // wait for dropdown menu
        try {
          await page.waitForSelector(pageElement[example], {
            visible: true
          });
        } catch (error) {
          errorMsg += `[PageTimeout]`;
          throw error;
        }

        await page.click(pageElement[example]);
        // wait for last results disappear
        await page.waitForSelector(`::-p-xpath(${pageElement.doneText})`, {
          hidden: true
        });

        // wait for model running results
        try {
          await page.waitForSelector(`::-p-xpath(${pageElement.doneText})`, {
            visible: true
          });
        } catch (error) {
          errorMsg += `[PageTimeout]`;
          throw error;
        }
        // get results
        const deNoiseInfoTextSpans = await page.$$eval(pageElement["deNoiseInfoTextRows"], (elements) =>
          elements.map((element) => element.textContent)
        );
        const stftComputeTime = deNoiseInfoTextSpans[0];
        const nsNet2ComputeTime = deNoiseInfoTextSpans[1];
        const iStftComputeTime = deNoiseInfoTextSpans[2];
        const processTime = deNoiseInfoTextSpans[3];
        // set results
        let pageResults = {
          stftComputeTime,
          nsNet2ComputeTime,
          iStftComputeTime,
          processTime
        };
        pageResults = util.replaceEmptyData(pageResults);
        console.log(`Test results ${example}: `, pageResults);

        const performResultPath = [sample, backend, dataType, model, "processTime"];
        initializePath(performResultPath);
        addValueToPath(performResultPath, pageResults.processTime);
      }
      // get extra results
      const loadInfoTextSpans = await page.$$eval(pageElement["loadInfoTextRows"], (elements) =>
        elements.map((element) => element.textContent)
      );
      const loadTime = loadInfoTextSpans[0];
      const buildTime = loadInfoTextSpans[1];
      const warmupTime = loadInfoTextSpans[2];
      // set results
      let extraResults = {
        loadTime,
        buildTime,
        warmupTime,
        error: errorMsg
      };
      extraResults = util.replaceEmptyData(extraResults);
      console.log("Extra results", extraResults);
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

module.exports = noiseSuppressionNsNet2Test;

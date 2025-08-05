const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");
const config = require("../../../config.json");

async function handwrittenDigitsClassificationTest({ backend, dataType, model } = {}) {
  const source = "samples";
  const sample = "handwritten-digits-classification";
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
    let browser;
    let page;

    const performResultsPath = [sample, backend, dataType, model, "inferenceTime"];
    const screenshotFilename = `${source}_${sample}_${backend}_${dataType}_${model}`;

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
      // choose backend
      await util.clickElementIfEnabled(page, pageElement[backend]);

      // wait for model building
      await Promise.race([
        page.waitForSelector(pageElement["handwrittenDigitsBuildTime"], {
          visible: true,
          timeout: config["timeout"]
        }),
        util.throwErrorOnElement(page, pageElement.alertWarning)
      ]);

      _.set(
        results,
        [sample, backend, dataType, model, "buildTime"],
        await page.$eval(pageElement.handwrittenDigitsBuildTime, (el) => el.textContent)
      );

      // loop test
      for (let i = 0; i < config[source][sample]["rounds"]; i++) {
        // click next button
        if (i !== 0) {
          await page.click(pageElement["nextButton"]);
          await util.delay(1000);
        }
        // click predict button
        await page.click(pageElement["predictButton"]);
        // wait for prediction result
        await Promise.race([
          page.waitForSelector(pageElement["handwrittenDigitsInferenceTime"], { visible: true }),
          util.throwErrorOnElement(page, pageElement.alertWarning)
        ]);

        // get results
        const inferenceTime = await page.$eval(pageElement["handwrittenDigitsInferenceTime"], (el) => el.textContent);
        const label0 = await page.$eval(pageElement["label0"], (el) => el.textContent);
        const prob0 = await page.$eval(pageElement["prob0"], (el) => el.textContent);
        const label1 = await page.$eval(pageElement["label1"], (el) => el.textContent);
        const prob1 = await page.$eval(pageElement["prob1"], (el) => el.textContent);
        const label2 = await page.$eval(pageElement["label2"], (el) => el.textContent);
        const prob2 = await page.$eval(pageElement["prob2"], (el) => el.textContent);

        // save canvas image
        const canvasImageName = `${sample}_${backend}_round${i}`;
        await util.saveCanvasImage(page, pageElement.handwrittenDigitsClassificationCanvas, canvasImageName);

        // set results for this round test
        let pageResults = {
          Label0: label0,
          Probability0: prob0,
          Label1: label1,
          Probability1: prob1,
          Label2: label2,
          Probability2: prob2,
          inferenceTime: inferenceTime
        };
        pageResults = util.replaceEmptyData(pageResults);
        console.log(`Test Results round${i}: `, pageResults);

        // assign performance results
        initializePath(performResultsPath);
        addValueToPath(performResultsPath, pageResults.inferenceTime);
      }
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

module.exports = handwrittenDigitsClassificationTest;

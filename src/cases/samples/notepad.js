const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");

async function notepadTest({ config, backend, dataType, model } = {}) {
  const source = "samples";
  let sample = "notepad";
  let results = {};

  const testExecution = async (backend, dataType, model) => {
    if (!["cpu", "gpu", "npu"].includes(backend)) {
      console.warn(`Invalid backend: ${backend}`);
      return;
    }

    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);

    const screenshotFilename = `${source}_${sample}_${backend}_${dataType}_${model}`;

    let errorMsg = "";
    let browser;
    let page;

    try {
      browser = await util.launchBrowser(config);
      page = (await browser.pages())[0];
      // set the default timeout time for the page
      page.setDefaultTimeout(config["timeout"]);

      // navigate the page to a URL
      await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][sample]}`, {
        waitUntil: "networkidle0"
      });
      // wait for select element display
      await page.waitForSelector(pageElement["deviceTypeSelect"]);
      await page.click(pageElement["deviceTypeSelect"]);
      // wait for option
      await page.waitForSelector(`${pageElement["deviceTypeSelect"]} option`);
      // choose option
      await page.select("select", backend);
      // wait for results display
      await util.delay(5000);
      await page.waitForSelector(pageElement["outputText"]);

      // get console results
      const actualValue = await page.$eval(pageElement["outputText"], (el) => el.innerHTML);
      // set error if actual value does not equal to the expected value
      if (actualValue !== config[source][sample]["expectedValue"]) {
        errorMsg = actualValue;
      }

      // set console results
      let pageResults = {
        expectedValue: config[source][sample]["expectedValue"],
        actualValue: actualValue,
        testResults: actualValue === config[source][sample]["expectedValue"] ? "pass" : "fail",
        error: errorMsg
      };
      console.log("Test Results: ", pageResults);
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

module.exports = notepadTest;

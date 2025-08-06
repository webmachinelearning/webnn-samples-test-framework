const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");

async function codeEditorTest({ config, backend, dataType, model } = {}) {
  let source = "samples";
  let sample = "codeEditor";
  let results = {};

  const testExecution = async (backend, dataType, model) => {
    if (!["cpu", "gpu", "npu"].includes(backend)) {
      console.warn(`Invalid backend: ${backend}`);
      return;
    }

    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);
    let errorMsg = "";
    let browser;

    try {
      browser = await util.launchBrowser(config);
      // open a new page
      const page = await browser.newPage();
      // set the default timeout time for the page
      page.setDefaultTimeout(config["timeout"]);

      // navigate the page to a URL
      const url = config["samplesBasicUrl"] + config["samplesUrl"][sample];
      await page.goto(url, {
        waitUntil: "networkidle0"
      });

      // wait for code text display
      await page.waitForSelector(pageElement["codeLine"]);
      for (let example of config[source][sample]["examples"]) {
        // click dropdown
        await page.click(pageElement["exampleSelect"]);
        // wait for option
        await page.waitForSelector(`${pageElement["exampleSelect"]} option`);
        // choose option
        await page.select("select", example.name);
        // wait for code text display
        await util.delay(5000);
        await page.waitForSelector(pageElement["codeLine"]);
        // click run button
        await page.click(pageElement["runButton"]);
        // get console results
        await util.delay(5000);
        const actualValue = await page.$eval(pageElement["consoleLog"], (el) => el.textContent);
        // set error if actual value does not equal to the expected value
        if (actualValue !== example.expectedValue) {
          // set only one error object for each backend, concat the error string for examples
          errorMsg = `${errorMsg !== "" ? errorMsg + "\n " : ""}${example.name}: ${actualValue}`;
        }
      }
    } catch (error) {
      errorMsg = error.message;
      console.log("Error occurred:", errorMsg);
    } finally {
      _.set(results, [sample, backend, dataType, model, "error"], errorMsg.substring(0, config.errorMsgMaxLength));
      if (browser) {
        await browser.close();
      }
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

module.exports = codeEditorTest;

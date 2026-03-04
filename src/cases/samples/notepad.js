const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const WebNNSample = require("./webnn-sample.js");

class NotepadTest extends WebNNSample {
  constructor(config) {
    super(config, "samples", "notepad");
  }

  async run(page, backend, dataType, model) {
    let errorMsg = "";
    await page.waitForSelector(pageElement.deviceTypeSelect);
    await page.click(pageElement.deviceTypeSelect);
    await page.waitForSelector(`${pageElement.deviceTypeSelect} option`);
    await page.select("select", backend);
    await util.delay(5000);
    await page.waitForSelector(pageElement.outputText);

    const actualValue = await page.$eval(pageElement.outputText, (el) => el.innerHTML);
    if (actualValue !== this.config[this.source][this.sample].expectedValue) {
      errorMsg = actualValue;
    }

    let pageResults = {
      expectedValue: this.config[this.source][this.sample].expectedValue,
      actualValue,
      testResults: actualValue === this.config[this.source][this.sample].expectedValue ? "pass" : "fail",
      error: errorMsg
    };
    console.log("Test Results: ", pageResults);
    return pageResults;
  }
}

async function notepadTest({ config, backend, dataType, model } = {}) {
  const test = new NotepadTest(config);
  return await test.execute(backend, dataType, model);
}

module.exports = notepadTest;

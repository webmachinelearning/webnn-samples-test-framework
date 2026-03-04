const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const WebNNSample = require("./webnn-sample.js");

class CodeEditorTest extends WebNNSample {
  constructor(config) {
    super(config, "samples", "code-editor");
  }

  async run(page, backend, dataType, model) {
    let errorMsg = "";
    await page.waitForSelector(pageElement.codeLine);
    for (let example of this.config[this.source][this.sample].examples) {
      await page.click(pageElement.exampleSelect);
      await page.waitForSelector(`${pageElement.exampleSelect} option`);
      await page.select("select", example.name);
      await util.delay(5000);
      await page.waitForSelector(pageElement.codeLine);
      await page.click(pageElement.runButton);
      await util.delay(5000);
      const actualValue = await page.$eval(pageElement.consoleLog, (el) => el.textContent);
      if (actualValue !== example.expectedValue) {
        errorMsg = `${errorMsg !== "" ? errorMsg + "\n " : ""}${example.name}: ${actualValue}`;
      }
    }
    return errorMsg;
  }
}

async function codeEditorTest({ config, backend, dataType, model } = {}) {
  const test = new CodeEditorTest({ config });
  return await test.execute(backend, dataType, model);
}

module.exports = codeEditorTest;

const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const WebNNSample = require("./webnn-sample.js");

class ImageClassificationTest extends WebNNSample {
  constructor(config) {
    super(config, "samples", "image-classification");
  }

  async run(page, backend, dataType, model) {
    await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
    const elementsToClick = [`#${backend}`, pageElement[dataType], pageElement[model]];

    for (const selector of elementsToClick) {
      await util.clickElementIfEnabled(page, selector);
      await util.delay(1000);
    }

    await Promise.race([
      page.waitForSelector(pageElement.computeTime, { visible: true }),
      util.throwErrorOnElement(page, pageElement.alertWarning)
    ]);

    const loadTime = await page.$eval(pageElement.loadTime, (el) => el.textContent);
    const buildTime = await page.$eval(pageElement.buildTime, (el) => el.textContent);
    const computeTime = await page.$eval(pageElement.computeTime, (el) => el.textContent);

    let pageResults = {
      loadTime: util.formatTimeResult(loadTime),
      buildTime: util.formatTimeResult(buildTime),
      inferenceTime: util.formatTimeResult(computeTime)
    };

    for (let i = 0; i < 3; i++) {
      pageResults[`label${i}`] = await page.$eval(pageElement[`label${i}`], (el) => el.textContent);
      pageResults[`probability${i}`] = await page.$eval(pageElement[`prob${i}`], (el) => el.textContent);
    }

    pageResults = util.replaceEmptyData(pageResults);
    console.log("Test Results: ", pageResults);

    return {
      buildTime: pageResults.buildTime,
      inferenceTime: pageResults.inferenceTime
    };
  }
}

async function imageClassificationTest({ config, backend, dataType, model } = {}) {
  const test = new ImageClassificationTest(config);
  return await test.execute(backend, dataType, model);
}

module.exports = imageClassificationTest;
module.exports.ImageClassificationTest = ImageClassificationTest;

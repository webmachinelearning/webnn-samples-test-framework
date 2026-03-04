const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const WebNNSample = require("./webnn-sample.js");
const path = require("path");

class ObjectDetectionTest extends WebNNSample {
  constructor(config) {
    super(config, "samples", "object-detection");
    this.expectedCanvas = path.join(path.resolve(__dirname), "../../../assets/canvas");
  }

  async run(page, backend, dataType, model) {
    let errorMsg = "";

    await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);

    const elementsToClick = [`#${backend}`, pageElement[dataType], pageElement[model]];
    for (const selector of elementsToClick) {
      await util.clickElementIfEnabled(page, selector);
    }

    await Promise.race([
      page.waitForSelector(pageElement.computeTime, { visible: true }),
      util.throwErrorOnElement(page, pageElement.alertWarning)
    ]);

    // Save and compare canvas image
    const canvasImageName = `${this.sample}_${dataType}_${model}`;
    const saveCanvasResult = await util.saveCanvasImage(page, pageElement.objectDetectionCanvas, canvasImageName);

    const expectedCanvasPath = `${this.expectedCanvas}/${this.sample}_${model}.png`;
    const compareImagesResults = util.compareImages(saveCanvasResult.canvasPath, expectedCanvasPath);

    console.log("Compare images results with the template image:", compareImagesResults);

    if (compareImagesResults < 95) {
      errorMsg += "Image result is not the same as template, please check saved images.";
    }

    const loadTime = await page.$eval(pageElement.loadTime, (el) => el.textContent);
    const buildTime = await page.$eval(pageElement.buildTime, (el) => el.textContent);
    const computeTime = await page.$eval(pageElement.computeTime, (el) => el.textContent);

    let pageResults = {
      loadTime: util.formatTimeResult(loadTime),
      buildTime: util.formatTimeResult(buildTime),
      inferenceTime: util.formatTimeResult(computeTime),
      compareImagesResults
    };

    pageResults = util.replaceEmptyData(pageResults);
    console.log("Test results: ", pageResults);

    if (errorMsg) {
      return errorMsg;
    }

    return {
      buildTime: pageResults.buildTime,
      inferenceTime: pageResults.inferenceTime
    };
  }
}

async function objectDetectionTest({ config, backend, dataType, model } = {}) {
  const test = new ObjectDetectionTest(config);
  return await test.execute(backend, dataType, model);
}

module.exports = objectDetectionTest;
module.exports.ObjectDetectionTest = ObjectDetectionTest;

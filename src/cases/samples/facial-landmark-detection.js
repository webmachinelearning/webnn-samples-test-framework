const WebNNSample = require("./webnn-sample.js");
const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const path = require("path");

class FacialLandmarkDetectionSample extends WebNNSample {
  constructor(config) {
    super(config, "samples", "facial-landmark-detection");
    this.models = ["simpleCnn"];
    this.expectedCanvas = path.join(path.resolve(__dirname), "../../../assets/canvas");
  }

  async run(page, backend, dataType, model) {
    const facialLandmark = this.models.find((name) => model.startsWith(name));
    const modelName = model.replace(facialLandmark, "").replace(/^./, (c) => c.toLowerCase());
    let errorMsg = "";

    await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);

    const elementsToClick = [pageElement[backend], pageElement[facialLandmark], pageElement[modelName]];
    for (const selector of elementsToClick) {
      await util.clickElementIfEnabled(page, selector);
      await util.delay(1000);
    }

    await Promise.race([
      page.waitForSelector(pageElement.computeTime, { visible: true }),
      util.throwErrorOnElement(page, pageElement.alertWarning)
    ]);

    const buildTime = await page.$eval(pageElement.buildTime, (el) => el.textContent);
    const computeTime = await page.$eval(pageElement.computeTime, (el) => el.textContent);

    try {
      const canvasImageName = `${this.sample}_${backend}_${facialLandmark}_${modelName}`;
      const saveCanvasResult = await util.saveCanvasImage(
        page,
        pageElement.facialLandmarkDetectionCanvas,
        canvasImageName
      );
      const expectedCanvasPath = `${this.expectedCanvas}/${this.sample}_${model}.png`;
      const compareImagesResults = util.compareImages(saveCanvasResult.canvasPath, expectedCanvasPath);

      console.log("Compare images results with the template image:", compareImagesResults);

      if (compareImagesResults < 95) {
        errorMsg += "Image result is not the same as template, please check saved images.";
      }
    } catch (error) {
      errorMsg += error.message;
    }

    return {
      buildTime: util.formatTimeResult(buildTime),
      inferenceTime: util.formatTimeResult(computeTime),
      error: errorMsg
    };
  }
}

async function facialLandmarkDetectionTest({ config, backend, dataType, model } = {}) {
  const sample = new FacialLandmarkDetectionSample(config);
  return await sample.execute(backend, dataType, model);
}

module.exports = facialLandmarkDetectionTest;

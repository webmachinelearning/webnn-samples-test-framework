const WebNNSample = require("./webnn-sample.js");
const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const path = require("path");

class FaceRecognitionSample extends WebNNSample {
  constructor(config) {
    super(config, "samples", "face-recognition");
    this.models = ["faceNet"];
    this.expectedCanvas = path.join(path.resolve(__dirname), "../../../assets/canvas");
  }

  async run(page, backend, dataType, model) {
    const faceRecognition = this.models.find((name) => model.startsWith(name));
    const modelName = model.replace(faceRecognition, "").replace(/^./, (c) => c.toLowerCase());
    let errorMsg = "";

    await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);

    const elementsToClick = [pageElement[backend], pageElement[faceRecognition], pageElement[modelName]];
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
      const canvasImageNameTarget = `${this.sample}_${backend}_${faceRecognition}_${modelName}_target`;
      const canvasImageNameSearch = `${this.sample}_${backend}_${faceRecognition}_${modelName}_search`;

      const saveCanvasResultTarget = await util.saveCanvasImage(
        page,
        pageElement.faceRecognitionTargetCanvas,
        canvasImageNameTarget
      );
      const saveCanvasResultSearch = await util.saveCanvasImage(
        page,
        pageElement.faceRecognitionSearchCanvas,
        canvasImageNameSearch
      );

      const expectedCanvasPathTarget = `${this.expectedCanvas}/${this.sample}_${faceRecognition}_${modelName}_target.png`;
      const compareImagesResultsTarget = util.compareImages(
        saveCanvasResultTarget.canvasPath,
        expectedCanvasPathTarget
      );

      const expectedCanvasPathSearch = `${this.expectedCanvas}/${this.sample}_${faceRecognition}_${modelName}_search.png`;
      const compareImagesResultsSearch = util.compareImages(
        saveCanvasResultSearch.canvasPath,
        expectedCanvasPathSearch
      );

      console.log("Compare search images results: ", compareImagesResultsSearch);
      console.log("Compare target images results: ", compareImagesResultsTarget);

      if (compareImagesResultsSearch < 95) {
        errorMsg += "Search Image result is not the same as template, please check saved images.";
      }
      if (compareImagesResultsTarget < 95) {
        errorMsg += "Target Image result is not the same as template, please check saved images.";
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

async function faceRecognitionTest({ config, backend, dataType, model } = {}) {
  const sample = new FaceRecognitionSample(config);
  return await sample.execute(backend, dataType, model);
}

module.exports = faceRecognitionTest;

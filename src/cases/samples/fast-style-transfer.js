const WebNNSample = require("./webnn-sample.js");
const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const path = require("path");

class FastStyleTransferSample extends WebNNSample {
  constructor(config) {
    super(config, "samples", "fast-style-transfer");
    this.expectedCanvas = path.join(path.resolve(__dirname), "../../../assets/canvas/fast-style-transfer");
  }

  async run(page, backend, dataType, model) {
    let errorMsg = "";
    let lastResults = {};

    await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);

    for (const example of this.config[this.source][this.sample].examples) {
      const elementsToClick = [pageElement[backend], pageElement[example]];
      for (const selector of elementsToClick) {
        await util.clickElementIfEnabled(page, selector);
      }

      await Promise.race([
        page.waitForSelector(pageElement.computeTime, { visible: true }),
        util.throwErrorOnElement(page, pageElement.alertWarning)
      ]);

      const buildTime = await page.$eval(pageElement.buildTime, (el) => el.textContent);
      const computeTime = await page.$eval(pageElement.computeTime, (el) => el.textContent);

      try {
        const saveCanvasImageInputResult = await util.saveCanvasImage(
          page,
          pageElement.fastStyleTransferInputCanvas,
          `${this.sample}/${example}_input`
        );

        const compareImageInputResults = util.compareImages(
          saveCanvasImageInputResult.canvasPath,
          `${this.expectedCanvas}/${example}_input.png`
        );

        if (compareImageInputResults < 95) {
          throw new Error(
            "Input image canvas is not the same as template. Please check if default selected image changes."
          );
        }

        const canvasImageName = `${this.sample}/${example}_output`;
        const saveCanvasResult = await util.saveCanvasImage(
          page,
          pageElement.fastStyleTransferOutputCanvas,
          canvasImageName
        );

        const expectedCanvasPath = `${this.expectedCanvas}/${example}_output.png`;
        const compareImagesOutputResults = util.compareImages(saveCanvasResult.canvasPath, expectedCanvasPath);

        console.log("Compare images results: ", compareImagesOutputResults);
        if (compareImagesOutputResults < 80) {
          errorMsg += "Image result is not the same as template, please check saved images.";
        }
      } catch (error) {
        console.log(error);
        errorMsg += error.message;
      }

      lastResults = {
        buildTime: util.formatTimeResult(buildTime),
        inferenceTime: util.formatTimeResult(computeTime),
        error: errorMsg
      };
    }

    return lastResults;
  }
}

async function fastStyleTransferTest({ config, backend, dataType, model } = {}) {
  const sample = new FastStyleTransferSample(config);
  return await sample.execute(backend, dataType, model);
}

module.exports = fastStyleTransferTest;
module.exports.FastStyleTransferSample = FastStyleTransferSample;

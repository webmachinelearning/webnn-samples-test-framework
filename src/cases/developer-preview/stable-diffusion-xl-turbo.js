const util = require("../../utils/util.js");
const DeveloperPreviewSample = require("./developer-preview-sample.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");

class StableDiffusionXlTurbo extends DeveloperPreviewSample {
  constructor(config) {
    super(config, "stable-diffusion-xl-turbo");
    this.recordMemory = true;
    this.timeoutMultiplier = 3;
  }

  async run(page, backend, dataType, model) {
    const pageElement = pageElementTotal[this.sample];

    await Promise.race([
      (async () => {
        await util.waitForElementEnabled(page, pageElement.loadModelsButton);
        await page.click(pageElement.loadModelsButton);
        await util.waitForElementEnabled(page, pageElement.generateImageButton);
      })(),
      util.throwOnUncaughtException(page)
    ]);

    await Promise.race([
      (async () => {
        await util.waitForElementEnabled(page, pageElement.generateImageButton);
        await page.click(pageElement.generateImageButton);
        await util.delay(200);
        await page.waitForFunction(
          (selector) => {
            const element = document.querySelector(selector);
            return element?.textContent.trim().match(/^\d+\.?\d*\s*ms$/);
          },
          {},
          pageElement.totalData
        );
        await util.delay(1000);
      })(),
      util.throwOnErrorLog(page),
      util.throwOnUncaughtException(page)
    ]);

    // Verify similarity
    const threshold = 75;
    for (let index = 0; index < 4; index++) {
      const canvasName = `stable-diffusion-xl-turbo-generation-${index}`;
      const { canvasPath } = await util.saveCanvasImage(page, pageElement[`imgCanvas${index}`], canvasName);

      const maxSimilarity = await util.checkImageGeneration(canvasPath, "stable-diffusion-xl-turbo");
      console.log(`The max similarity of this ${canvasName} is ${maxSimilarity}`);
      if (maxSimilarity < threshold) {
        throw new Error(
          `The generated image is significantly below expectations. Please review the image at: ${canvasPath}`
        );
      }
    }

    const buildTime = [];
    for (const modelName of ["textEncoder", "textEncoder2", "unet", "vae"]) {
      buildTime.push(await page.$eval(pageElement[`${modelName}Create`], (el) => el.textContent));
    }
    const inferenceTime = await page.$eval(pageElement.runTotal, (el) => el.textContent);

    const result = { all: { buildTime, inferenceTime } };
    console.log(result);
    return result;
  }
}

module.exports = async function ({ config, backend, dataType, model }) {
  const instance = new StableDiffusionXlTurbo(config);
  return await instance.execute(backend, dataType, model);
};

const util = require("../../utils/util.js");
const BaseSample = require("./base-sample.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");

class StableDiffusion15 extends BaseSample {
  constructor(config) {
    super(config, "stable-diffusion-1-5");
    this.recordMemory = true;
    this.config.timeout *= 3;
  }

  async run(page, backend, dataType, model) {
    const pageElement = pageElementTotal[this.sample];

    // Step 1: Load models
    await Promise.race([
      (async () => {
        await util.waitForElementEnabled(page, pageElement.loadModelsButton);
        await page.click(pageElement.loadModelsButton);
        await util.waitForElementEnabled(page, pageElement.generateImageButton);
      })(),
      util.throwOnUncaughtException(page)
    ]);

    let result = {};
    for (let i = 0; i < this.sampleConfig.rounds; i++) {
      // Step 2: Generate image
      await Promise.race([
        (async () => {
          await page.click(pageElement.generateImageButton);
          await util.waitForElementEnabled(page, pageElement.generateImageButton);
        })(),
        util.throwErrorOnElement(page, "#error"),
        util.throwOnUncaughtException(page)
      ]);

      await util.delay(1000);

      // Step 3: Collect results
      for (const subModel of ["textEncoder", "unet", "vaeDecoder", "safetyChecker"]) {
        const modelKey = this.sampleConfig.rounds > 1 ? `${subModel}-run-${i + 1}` : subModel;
        result[modelKey] = result[modelKey] || {};
        if (subModel === "unet") {
          result[modelKey].build = await page.$eval(pageElement.unetCreate, (el) => el.textContent);
          const unetRunRaw = await page.$eval(pageElement.unetRun, (el) => el.innerHTML);
          const unetRuns = unetRunRaw.split("<br>", 1)[0].split(" ").map(Number);
          result[modelKey].first = unetRuns[0].toFixed(2);
          result[modelKey].average = util.calculateAverage(unetRuns);
          result[modelKey].median = util.getMedianValue(unetRuns);
          result[modelKey].best = util.getBestValue(unetRuns);
        } else {
          result[modelKey].buildTime = await page.$eval(pageElement[`${subModel}Create`], (el) => el.textContent);
          result[modelKey].inferenceTime = await page.$eval(pageElement[`${subModel}Run`], (el) => el.textContent);
        }
      }
    }

    console.log(result);
    return result;
  }
}

module.exports = async function ({ config, backend, dataType, model }) {
  const instance = new StableDiffusion15(config);
  return await instance.execute(backend, dataType, model);
};

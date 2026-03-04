const util = require("../../utils/util.js");
const DeveloperPreviewSample = require("./developer-preview-sample.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");

async function throwOnErrorLog(page) {
  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const lines = element.innerText.split("\n");
      for (const line of lines) {
        if (line.includes("[Error]")) {
          throw Error(line.split("[Error]")[1].trim());
        }
      }
      return false;
    },
    {},
    "#log"
  );
}

class StableDiffusionTurbo extends DeveloperPreviewSample {
  constructor(config) {
    super(config, "stable-diffusion-turbo");
    this.recordMemory = true;
    this.config.timeout *= 3;
  }

  async run(page, backend, dataType, model) {
    const pageElement = pageElementTotal[this.sample];

    await Promise.race([
      (async () => {
        await util.waitForElementEnabled(page, pageElement["loadModelsButton"]);
        await page.click(pageElement["loadModelsButton"]);
        await util.waitForElementEnabled(page, pageElement["generateImageButton"]);
      })(),
      util.throwOnUncaughtException(page)
    ]);

    // loop test
    let result = {};
    const rounds = this.config[this.source][this.sample].rounds;
    for (let i = 0; i < rounds; i++) {
      await Promise.race([
        (async () => {
          await util.waitForElementEnabled(page, pageElement["generateImageButton"]);
          await page.click(pageElement["generateImageButton"]);
          await util.delay(200);
          // wait results (image 4 show)
          await page.waitForFunction(
            (selector) => {
              const element = document.querySelector(selector);
              return element?.textContent.trim().match(/^\d+\.?\d*\s*ms$/);
            },
            {},
            pageElement["data4"]
          );
          let image4Time = await page.$eval(pageElement["data4"], (el) => el.textContent);
          let checkCount = 0;
          while (image4Time.includes("...")) {
            await util.delay(1000);
            image4Time = await page.$eval(pageElement["data4"], (el) => el.textContent);
            checkCount++;
            if (checkCount > 60) break;
          }
          await util.delay(1000);
        })(),
        throwOnErrorLog(page),
        util.throwOnUncaughtException(page)
      ]);

      // Verify similarity
      const threshold = 75;
      for (let index = 0; index < 4; index++) {
        const canvasName = `stable-diffusion-turbo-generation-round${i}-${index}`;
        const { canvasPath } = await util.saveCanvasImage(page, pageElement[`imgCanvas${index}`], canvasName);

        const maxSimilarity = await util.checkImageGeneration(canvasPath);
        console.log(`The max similarity of this ${canvasName} is ${maxSimilarity}`);
        if (maxSimilarity < threshold) {
          throw new Error(
            `The generated image is significantly below expectations. Please review the image at: ${canvasPath}`
          );
        }
      }

      const loadResults = {};
      for (const modelName of ["textEncoder", "unet", "vaeDecoder", "safetyChecker"]) {
        for (const method of ["Fetch", "Create"]) {
          const key = modelName + method;
          loadResults[key] = await page.$eval(pageElement[key], (el) => el.textContent);
        }

        const modelKey = rounds > 1 ? `${modelName}-run-${i + 1}` : modelName;
        result[modelKey] = result[modelKey] || {};
        result[modelKey].buildTime = loadResults[modelName + "Create"];
      }

      const executionResults = {
        textEncoder: [],
        unet: [],
        vaeDecoder: [],
        safetyChecker: []
      };

      for (const key of ["textEncoder", "unet", "vaeDecoder", "safetyChecker"]) {
        for (let k = 1; k <= 4; k++) {
          executionResults[key].push(await page.$eval(pageElement[`${key}Run${k}`], (el) => el.textContent));
        }
      }

      Object.entries(executionResults).forEach(([_model, _value]) => {
        if (!model || model === _model) {
          const modelKey = rounds > 1 ? `${_model}-run-${i + 1}` : _model;
          result[modelKey] = result[modelKey] || {};
          result[modelKey].first = Number(_value[0]).toFixed(2);
          result[modelKey].average = util.calculateAverage(_value);
          result[modelKey].median = util.getMedianValue(_value);
          result[modelKey].best = util.getBestValue(_value);
        }
      });

      console.log(`Load models test results inferenceRound_${i}: `, loadResults);
      console.log(`Test results inferenceRound_${i}: `, executionResults);
    }

    console.log(result);
    return result;
  }
}

module.exports = async function ({ config, backend, dataType, model }) {
  const instance = new StableDiffusionTurbo(config);
  return await instance.execute(backend, dataType, model);
};

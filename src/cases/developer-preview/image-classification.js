// Enhance test scenarios by running a sample multiple times on the same page,
// meaning the page will not be closed after each inference.
// Using `Image Classification` as an example, the following scenarios are included:
//   1. Standard test: Select one backend and one model, click `classify`
//   2. Repeat inference: Click `classify` multiple times in one page
//   3. Switch backend and models: Switch backend or models then click `classify` in one page

const util = require("../../utils/util.js");
const DeveloperPreviewSample = require("./developer-preview-sample.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");

class ImageClassificationBase extends DeveloperPreviewSample {
  async classify(page, pageElement) {
    await Promise.race([
      (async () => {
        await util.waitForElementEnabled(page, pageElement.classifyButton);
        await page.click(pageElement.classifyButton);
        await page.waitForSelector(pageElement.result, { visible: true });
      })(),
      util.throwOnDevelopmentPreviewError(page, pageElement.alertWaring)
    ]);
    return await this.getPageResults(page, pageElement);
  }

  async getPageResults(page, pageElement) {
    const performanceResults = {};
    for (const metric of ["median", "first", "best", "average", "throughput"]) {
      let value = await page.$eval(pageElement[metric], (el) => el.textContent);
      if (metric === "throughput") value = value.replace("FPS", "").trim();
      performanceResults[metric] = value;
    }

    const imageResults = {};
    for (let i = 1; i <= 3; i++) {
      for (const key of ["label", "score"]) {
        imageResults[`${key}${i}`] = await page.$eval(pageElement[`${key}${i}`], (el) => el.textContent);
      }
    }
    return { performanceResults, imageResults };
  }
}

class ImageClassificationStandard extends ImageClassificationBase {
  constructor(config) {
    super(config, "image-classification");
  }

  async run(page, backend, dataType, model) {
    const pageElement = pageElementTotal[this.sample];

    const { performanceResults, imageResults } = await this.classify(page, pageElement);
    console.log("Test Results: ", performanceResults, imageResults);

    return performanceResults;
  }

  async execute(backend, dataType, model) {
    return await super.execute(backend, dataType, model);
  }
}

class ImageClassificationRepeatInference extends ImageClassificationBase {
  constructor(config) {
    super(config, "image-classification");
    this.resultKey = "image-classification-repeat-inference";
  }

  async run(page, backend, dataType, model) {
    const pageElement = pageElementTotal[this.sample];
    const testRounds = 5;
    const delayMs = 500;

    let lastPerformanceResults = {};
    for (let i = 0; i < testRounds; i++) {
      console.log(`round: ${i} testing ...`);
      const { performanceResults, imageResults } = await this.classify(page, pageElement);
      console.log(`Round:${i} test results: `, performanceResults, imageResults);
      lastPerformanceResults = performanceResults;
      await util.delay(delayMs);
    }

    return lastPerformanceResults;
  }
}

class ImageClassificationSwitchBackendAndModels extends ImageClassificationBase {
  constructor(config) {
    super(config, "image-classification");
    this.resultKey = "image-classification-switch-backend-and-models";
  }

  async execute(backend, dataType, model) {
    return super.runCase(backend, dataType, model);
  }

  async run(page, backend, dataType, model) {
    const pageElement = pageElementTotal[this.sample];

    let result = {};
    for (backend of this.config[this.source][this.sample].backends) {
      await page.click(pageElement[backend]);
      for (model of this.config[this.source][this.sample].models) {
        await page.click(pageElement[model]);
        const { performanceResults, imageResults } = await this.classify(page, pageElement);
        _.set(result, [this.sample, backend, model], performanceResults);
        console.log("Test Results: ", performanceResults, imageResults);
        await util.delay(500);
      }
    }

    return result;
  }
}

class ImageClassification extends ImageClassificationBase {
  async execute(backend, dataType, model) {
    // Step 1: Standard test uses BaseSample.execute
    const step1 = new ImageClassificationStandard(this.config);
    // Step 2: Repeat inference in one page (5 rounds + 500ms delay)
    const step2 = new ImageClassificationRepeatInference(this.config);
    // Step 3: Switch backend/models on the same page (only meaningful for full suite)
    const step3 = new ImageClassificationSwitchBackendAndModels(this.config);

    let results = {
      ...(await step1.execute(backend, dataType, model)),
      ...(await step2.execute(backend, dataType, model))
    };

    if (!backend && !dataType && !model) {
      results = { ...results, ...(await step3.execute()) };
    }

    return results;
  }
}

module.exports = async function ({ config, backend, dataType, model }) {
  const imageClassification = new ImageClassification(config);
  return await imageClassification.execute(backend, dataType, model);
};

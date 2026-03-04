const WebNNSample = require("./webnn-sample.js");
const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");

class NoiseSuppressionRNNoiseSample extends WebNNSample {
  constructor(config) {
    super(config, "samples", "noise-suppression-rnnoise");
  }

  async run(page, backend, dataType, model) {
    await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
    await util.clickElementIfEnabled(page, pageElement[backend]);

    await Promise.race([
      page.waitForSelector(`::-p-xpath(${pageElement.readyText})`, { visible: true }),
      util.throwErrorOnElement(page, pageElement.alertWarning)
    ]);

    const exampleResults = {};
    for (const example of this.config[this.source][this.sample].examples) {
      await page.click(pageElement.chooseAudioButton);
      await Promise.race([
        page.waitForSelector(pageElement[example], { visible: true }),
        util.throwErrorOnElement(page, pageElement.alertWarning)
      ]);

      await page.click(pageElement[example]);
      await page.waitForSelector(`::-p-xpath(${pageElement.doneText})`, { hidden: true });
      await Promise.race([
        page.waitForSelector(`::-p-xpath(${pageElement.doneText})`, { visible: true }),
        util.throwErrorOnElement(page, pageElement.alertWarning)
      ]);

      const deNoiseInfoTextSpans = await page.$$eval(pageElement.deNoiseInfoTextRows, (elements) =>
        elements.map((el) => el.textContent)
      );

      const [preProcessingTime, rnNoiseComputeTime, postProcessingTime, processTime] = deNoiseInfoTextSpans.map(
        util.formatTimeResult
      );
      exampleResults[example] = { preProcessingTime, rnNoiseComputeTime, postProcessingTime, processTime };
      console.log(`Test results ${example}: `, exampleResults[example]);
    }

    const loadInfoTextSpans = await page.$$eval(pageElement.loadInfoTextRows, (elements) =>
      elements.map((el) => el.textContent)
    );
    const [loadTime, buildTime] = loadInfoTextSpans.map(util.formatTimeResult);

    return {
      loadTime,
      buildTime,
      inferenceTime: Object.values(exampleResults).map((res) => res.processTime),
      exampleResults
    };
  }
}

async function noiseSuppressionRnNoiseTest({ config, backend, dataType, model } = {}) {
  const sample = new NoiseSuppressionRNNoiseSample(config);
  return await sample.execute(backend, dataType, model);
}

module.exports = noiseSuppressionRnNoiseTest;

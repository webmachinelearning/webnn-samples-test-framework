const WebNNSample = require("./webnn-sample.js");
const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");

class HandwrittenDigitsClassificationSample extends WebNNSample {
  constructor(config) {
    super(config, "samples", "handwritten-digits-classification");
  }

  async run(page, backend, dataType, model) {
    await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
    await util.clickElementIfEnabled(page, pageElement[backend]);

    await Promise.race([
      page.waitForSelector(pageElement.handwrittenDigitsBuildTime, {
        visible: true,
        timeout: this.config.timeout
      }),
      util.throwErrorOnElement(page, pageElement.alertWarning)
    ]);

    const buildTime = await page.$eval(pageElement.handwrittenDigitsBuildTime, (el) => el.textContent);
    const inferenceTimes = [];

    for (let i = 0; i < this.config[this.source][this.sample].rounds; i++) {
      if (i !== 0) {
        await page.click(pageElement.nextButton);
        await util.delay(1000);
      }
      await page.click(pageElement.predictButton);
      await Promise.race([
        page.waitForSelector(pageElement.handwrittenDigitsInferenceTime, { visible: true }),
        util.throwErrorOnElement(page, pageElement.alertWarning)
      ]);

      const inferenceTime = await page.$eval(pageElement.handwrittenDigitsInferenceTime, (el) => el.textContent);

      let pageResults = { inferenceTime };
      for (let j = 0; j < 3; j++) {
        pageResults[`Label${j}`] = await page.$eval(pageElement[`label${j}`], (el) => el.textContent);
        pageResults[`Probability${j}`] = await page.$eval(pageElement[`prob${j}`], (el) => el.textContent);
      }

      const canvasImageName = `${this.sample}_${backend}_round${i}`;
      await util.saveCanvasImage(page, pageElement.handwrittenDigitsClassificationCanvas, canvasImageName);

      pageResults = util.replaceEmptyData(pageResults);
      console.log(`Test Results round${i}: `, pageResults);
      inferenceTimes.push(pageResults.inferenceTime);
    }

    return {
      buildTime: util.formatTimeResult(buildTime),
      inferenceTime: inferenceTimes.map(util.formatTimeResult)
    };
  }
}

async function handwrittenDigitsClassificationTest({ config, backend, dataType, model } = {}) {
  const sample = new HandwrittenDigitsClassificationSample(config);
  return await sample.execute(backend, dataType, model);
}

module.exports = handwrittenDigitsClassificationTest;

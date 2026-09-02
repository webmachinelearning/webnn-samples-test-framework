const util = require("../../utils/util.js");
const DeveloperPreviewSample = require("./developer-preview-sample.js");

class TextGeneration extends DeveloperPreviewSample {
  constructor(config) {
    super(config, "text-generation");
    this.timeoutMultiplier = 3;
  }

  async run(page, backend, dataType, model) {
    const result = {
      ttft: [],
      tps: []
    };
    const ttftSelector = '.performance-data[title="Time to first token"] .tokens-per-second-performance-data';
    const tpsSelector = '.performance-data[title="tokens per second"] .tokens-per-second-performance-data';

    await Promise.race([
      (async () => {
        await util.waitForElementEnabled(page, "#send-button");
        for (const { question, answer } of this.sampleConfig.cases) {
          // Drop the previous case's performance data so the wait below cannot match a stale value.
          await page.evaluate(() => {
            const indicator = document.querySelector("#performance-indicator");
            if (indicator) indicator.innerHTML = "";
          });
          await page.type("#user-input", question);
          await page.click("#send-button");
          await util.waitForElementEnabled(page, "#send-button");

          // The page renders the performance data at the end of the generation, which can land
          // slightly after the send button is re-enabled, so wait for it instead of reading it directly.
          await page.waitForSelector(ttftSelector);
          const timeToFirstToken = await page.$eval(ttftSelector, (el) => el.textContent.trim());
          await page.waitForSelector(tpsSelector);
          const tokensPerSecond = await page.$eval(tpsSelector, (el) => el.textContent.trim());
          result.ttft.push(util.formatTimeResult(timeToFirstToken));
          result.tps.push(util.formatTimeResult(tokensPerSecond));

          const lastResponse = await page.$$(".response-message");
          let responseText = (
            await (await lastResponse[lastResponse.length - 1].getProperty("textContent")).jsonValue()
          ).trim();
          if (responseText !== answer.trim()) {
            if (responseText.length > 64) {
              throw new Error(
                `Got "${responseText.slice(0, 64)}" and ${responseText.length - 64} more bytes, ` +
                  `expected "${answer.trim()}" for the question "${question}"`
              );
            } else {
              throw new Error(`Got "${responseText}", expected "${answer.trim()}" for the question "${question}"`);
            }
          }
        }
      })(),
      util.throwOnUncaughtException(page)
    ]);

    console.log(result);
    return result;
  }
}

module.exports = async function ({ config, backend, dataType, model }) {
  const textGeneration = new TextGeneration(config);
  return await textGeneration.execute(backend, dataType, model);
};

const _ = require("lodash");

const util = require("../../utils/util");

module.exports = async function ({ config, backend, dataType, model }) {
  const args = [];
  if (backend && dataType && model) {
    args.push([backend, dataType, model]);
  } else {
    for (const [backend, dataTypes] of Object.entries(config["developer-preview"]["text-generation"])) {
      if (backend in ["cpu", "gpu", "npu"]) {
        for (const [dataType, models] of Object.entries(dataTypes)) {
          for (const model of models) {
            args.push([backend, dataType, model]);
          }
        }
      }
    }
  }
  config.timeout *= 3;
  const results = {};
  for (const [backend, dataType, model] of args) {
    const browser = await util.launchBrowser(config);
    const page = (await browser.pages())[0];
    page.setDefaultTimeout(config.timeout);
    const result = {
      ttft: [],
      tps: []
    };
    try {
      const urlArgs = new URLSearchParams();
      urlArgs.append("devicetype", backend);
      urlArgs.append("model", model);
      await page.goto(config.developerPreviewBasicUrl + config.developerPreviewUrl["text-generation"] + "?" + urlArgs, {
        waitUntil: "networkidle0"
      });
      await Promise.race([
        (async function () {
          await util.waitForElementEnabled(page, "#send-button");
          for (const { question, answer } of config["developer-preview"]["text-generation"].cases) {
            // It must be such a system prompt to make it function normally.
            await page.type("#user-input", "You are a helpful AI assistant. " + question);
            await page.click("#send-button");
            await util.waitForElementEnabled(page, "#send-button");

            const timeToFirstToken = await page.$eval(
              '.performance-data[title="Time to first token"] .tokens-per-second-performance-data',
              (el) => el.textContent.trim()
            );
            const tokensPerSecond = await page.$eval(
              '.performance-data[title="tokens per second"] .tokens-per-second-performance-data',
              (el) => el.textContent.trim()
            );
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
    } catch (error) {
      console.warn(error.message);
      result.error = error.message.substring(0, config.errorMsgMaxLength);
    } finally {
      await util.saveScreenshot(page, `text-generation_${backend}_${dataType}_${model}`);
      await browser.close();
    }
    _.set(results, [backend, dataType, model], result);
  }
  return { "text-generation": results };
};

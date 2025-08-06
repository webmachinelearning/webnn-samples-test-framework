const _ = require("lodash");

const util = require("../../utils/util");
const pageElement = require("../../page-elements/samples");

module.exports = async function ({ config, backend, dataType, model }) {
  const args = [];
  if (backend && dataType && model) {
    args.push([backend, dataType, model]);
  } else {
    for (const [backend, dataTypes] of Object.entries(config.samples["selfie-segmentation"])) {
      for (const [dataType, models] of Object.entries(dataTypes)) {
        for (const model of models) {
          args.push([backend, dataType, model]);
        }
      }
    }
  }
  const results = {};
  for (const [backend, dataType, model] of args) {
    const browser = await util.launchBrowser(config);
    const page = (await browser.pages())[0];
    page.setDefaultTimeout(config.timeout);
    try {
      await page.goto(config.samplesBasicUrl + config.samplesUrl["selfie-segmentation"], { waitUntil: "networkidle0" });
      await Promise.race([
        (async function () {
          await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
          await util.clickElementIfEnabled(page, `#${backend}`);
          await util.clickElementIfEnabled(page, pageElement[dataType]);
          await util.clickElementIfEnabled(page, `#${model}`);
          await page.waitForSelector(pageElement.computeTime, { visible: true });
        })(),
        util.throwErrorOnElement(page, pageElement.alertWarning)
      ]);
      let result = {
        buildTime: await page.$eval(pageElement.buildTime, (el) => el.textContent),
        inferenceTime: await page.$eval(pageElement.computeTime, (el) => el.textContent)
      };
      result = _.mapValues(result, util.formatTimeResult);
      console.log(result);
      _.set(results, [backend, dataType, model], result);
    } catch (error) {
      console.warn(error.message);
      _.set(results, [backend, dataType, model, "error"], error.message.substring(0, config.errorMsgMaxLength));
    } finally {
      await util.saveScreenshot(page, `selfie-segmentation_${backend}_${dataType}_${model}`);
      await browser.close();
    }
  }
  return { "selfie-segmentation": results };
};

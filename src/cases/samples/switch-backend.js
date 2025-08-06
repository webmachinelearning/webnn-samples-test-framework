/** Test in sample: image_classification
 * switch different backend or models
 */
const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");

async function switchBackendTest({ config }) {
  let source = "samples";
  let sample = "switchBackendTest";

  // get the first subsample and only test this one
  const subSample = Object.keys(config[source][sample].samples)[0];
  const testRounds = config[source][sample]["rounds"];

  const testExecution = async (page, index, backend, dataType, model) => {
    console.log(
      `${source} ${sample} ${subSample} ${backend} ${dataType} ${model} totalTestRounds: ${testRounds}, currentTestRounds:${index} testing...`
    );

    const screenshotFilename = `${source}_${sample}_${subSample}_${backend}_${dataType}_${model}_round${index}`;
    let subSampleResults = {};

    try {
      const elementsToClick = [pageElement[backend], pageElement[dataType], pageElement[model]];

      for (const selector of elementsToClick) {
        await util.clickElementIfEnabled(page, selector);
      }
      // wait for last results disappear
      await page.waitForSelector(pageElement["computeTime"], {
        hidden: true
      });
      // wait for model running results
      await page.waitForSelector(pageElement["computeTime"], {
        visible: true
      });

      await util.delay(500);

      // get final round test results
      if (index === testRounds - 1) {
        const loadTime = await page.$eval(pageElement["loadTime"], (el) => el.textContent);
        const buildTime = await page.$eval(pageElement["buildTime"], (el) => el.textContent);
        const computeTime = await page.$eval(pageElement["computeTime"], (el) => el.textContent);
        const label0 = await page.$eval(pageElement["label0"], (el) => el.textContent);
        const prob0 = await page.$eval(pageElement["prob0"], (el) => el.textContent);
        const label1 = await page.$eval(pageElement["label1"], (el) => el.textContent);
        const prob1 = await page.$eval(pageElement["prob1"], (el) => el.textContent);
        const label2 = await page.$eval(pageElement["label2"], (el) => el.textContent);
        const prob2 = await page.$eval(pageElement["prob2"], (el) => el.textContent);

        let pageResults = {
          loadTime: util.formatTimeResult(loadTime),
          buildTime: util.formatTimeResult(buildTime),
          inferenceTime: util.formatTimeResult(computeTime),
          labe0: label0,
          probability0: prob0,
          label1: label1,
          probability1: prob1,
          label2: label2,
          probability2: prob2,
        };

        pageResults = util.replaceEmptyData(pageResults);
        _.set(subSampleResults, [subSample, backend, dataType, model, "buildTime"], pageResults.buildTime);
        _.set(subSampleResults, [subSample, backend, dataType, model, "inferenceTime"], pageResults.inferenceTime);
      }
    } catch (error) {
      if (page) {
        await util.saveScreenshot(page, screenshotFilename);
      }
      console.warn(error.message);
      _.set(
        subSampleResults,
        [subSample, backend, dataType, model, "error"],
        error.message.substring(0, config.errorMsgMaxLength)
      );
    }
    return subSampleResults;
  };

  let results = {};
  let browser;

  // launch the browser
  try {
    browser = await util.launchBrowser(config);
    const page = (await browser.pages())[0];
    page.setDefaultTimeout(config["timeout"]);

    // navigate the page to a URL
    await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][subSample]}`, {
      waitUntil: "networkidle0"
    });
    // wait for page text display
    await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);

    for (let i = 0; i < testRounds; i++) {
      for (let backend in config[source][sample]["samples"][subSample]) {
        for (let dataType in config[source][sample]["samples"][subSample][backend]) {
          for (let model of config[source][sample]["samples"][subSample][backend][dataType]) {
            _.set(results, [sample], await testExecution(page, i, backend, dataType, model));
          }
        }
      }
    }
  } catch (error) {
    for (let backend in config[source][sample]["samples"][subSample]) {
      for (let dataType in config[source][sample]["samples"][subSample][backend]) {
        for (let model of config[source][sample]["samples"][subSample][backend][dataType]) {
          _.set(
            results,
            [sample, subSample, backend, dataType, model, "error"],
            error.message.substring(0, config.errorMsgMaxLength)
          );
        }
      }
    }
  } finally {
    if (browser) await browser.close();
  }
  return results;
}

module.exports = switchBackendTest;

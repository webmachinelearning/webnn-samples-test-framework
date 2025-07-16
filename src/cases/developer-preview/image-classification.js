// Enhance test scenarios by running a sample multiple times on the same page,
// meaning the page will not be closed after each inference.
// Using `Image Classification` as an example, the following scenarios are included:
//    Select one backend and one model, click `classify` then
//      1. Click `classify` multiple times - repeatInference
//      2. Change backend or models then click `classify` - switchBackendAndModels

const puppeteer = require("puppeteer");
const qs = require("qs");
const util = require("../../utils/util.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");
const _ = require("lodash");
const config = require("../../../config.json");

async function imageClassificationPreviewTest({ backend, dataType, model } = {}) {
  const source = "developerPreview";
  const sample = "imageClassification";
  let results = {};
  const pageElement = pageElementTotal[sample];

  const launchBrowser = async (args, browserPath, userDataDir) => {
    return await puppeteer.launch({
      headless: config.headless,
      defaultViewport: null,
      args,
      executablePath: browserPath,
      ignoreHTTPSErrors: true,
      protocolTimeout: config.timeout,
      userDataDir
    });
  };

  const getPageResults = async (page) => {
    const performanceResults = {
      median: await page.$eval(pageElement.median, (el) => el.textContent),
      first: await page.$eval(pageElement.first, (el) => el.textContent),
      best: await page.$eval(pageElement.best, (el) => el.textContent),
      average: await page.$eval(pageElement.average, (el) => el.textContent),
      throughput: (await page.$eval(pageElement.throughput, (el) => el.textContent)).replace("FPS", "").trim()
    };
    const imageResults = {
      label1: await page.$eval(pageElement.label1, (el) => el.textContent),
      score1: await page.$eval(pageElement.score1, (el) => el.textContent),
      label2: await page.$eval(pageElement.label2, (el) => el.textContent),
      score2: await page.$eval(pageElement.score2, (el) => el.textContent),
      label3: await page.$eval(pageElement.label3, (el) => el.textContent),
      score3: await page.$eval(pageElement.score3, (el) => el.textContent)
    };
    return { performanceResults, imageResults };
  };

  const testExecution = async (backend, dataType, model) => {
    console.log(`${source} ${sample} ${backend} ${model} testing...`);
    const screenshotFilename = `${source}_${sample}_${backend}_${dataType}_${model}`;
    const args = util.getBrowserArgs(backend);
    const { browserPath, userDataDir } = util.getBrowserPath(config.browser);
    let browser;
    let page;

    try {
      browser = await launchBrowser(args, browserPath, userDataDir);
      page = await browser.newPage();
      page.setDefaultTimeout(config.timeout);

      const urlQuery = qs.stringify({
        ...config[source][sample].urlArgs[backend],
        ...config[source][sample].urlArgs[model]
      });
      await page.goto(`${config.developerPreviewBasicUrl}${config.developerPreviewUrl[sample]}?${urlQuery}`, {
        waitUntil: "networkidle0"
      });

      await Promise.race([
        (async () => {
          await util.waitForElementEnabled(page, pageElement.classifyButton);
          await page.click(pageElement.classifyButton);
          await page.waitForSelector(pageElement.result, { visible: true });
        })(),
        util.throwOnDevelopmentPreviewError(page, pageElement.alertWaring)
      ]);

      const { performanceResults, imageResults } = await getPageResults(page);
      Object.entries(performanceResults).forEach(([_metric, _value]) => {
        _.set(results, [sample, backend, dataType, model, _metric], _value);
      });

      console.log("Test Results: ", performanceResults, imageResults);
    } catch (error) {
      _.set(results, [sample, backend, dataType, model, "error"], error.message.substring(0, config.errorMsgMaxLength));
      console.warn(error.message);
    } finally {
      if (page) await util.saveScreenshot(page, screenshotFilename);
      if (browser) await browser.close();
    }
  };

  const repeatInferenceInOnePage = async (backend, dataType, model) => {
    const type = "repeatInference";
    const testRounds = 5;
    console.log(`Repeat Inference in one page ${source} ${sample} ${backend} ${model} testing...`);
    const screenshotFilename = `${source}_${type}_${sample}_${backend}_${dataType}_${model}`;
    const args = util.getBrowserArgs(backend);
    const { browserPath, userDataDir } = util.getBrowserPath(config.browser);
    let browser;
    let page;

    try {
      browser = await launchBrowser(args, browserPath, userDataDir);
      page = await browser.newPage();
      page.setDefaultTimeout(config.timeout);

      const urlQuery = qs.stringify({
        ...config[source][sample].urlArgs[backend],
        ...config[source][sample].urlArgs[model]
      });
      await page.goto(`${config.developerPreviewBasicUrl}${config.developerPreviewUrl[sample]}?${urlQuery}`, {
        waitUntil: "networkidle0"
      });

      for (let i = 0; i < testRounds; i++) {
        console.log(`round: ${i} testing ...`);
        await Promise.race([
          (async () => {
            await util.waitForElementEnabled(page, pageElement.classifyButton);
            await page.click(pageElement.classifyButton);
            await page.waitForSelector(pageElement.result, { visible: true });
          })(),
          util.throwOnDevelopmentPreviewError(page, pageElement.alertWaring)
        ]);

        const { performanceResults, imageResults } = await getPageResults(page);
        console.log(`Round:${i} test results: `, performanceResults, imageResults);

        if (i === testRounds - 1) {
          Object.entries(performanceResults).forEach(([_metric, _value]) => {
            _.set(results, [type + "_" + sample, backend, dataType, model, _metric], _value);
          });
        }
        await util.delay(500);
      }
    } catch (error) {
      _.set(
        results,
        [type + "_" + sample, backend, dataType, model, "error"],
        error.message.substring(0, config.errorMsgMaxLength)
      );
      console.warn(error.message);
    } finally {
      if (page) await util.saveScreenshot(page, screenshotFilename);
      if (browser) await browser.close();
    }
  };

  const switchBackendAndModels = async () => {
    const type = "switchBackendNModel";
    const args = util.getBrowserArgs();
    const { browserPath, userDataDir } = util.getBrowserPath(config.browser);
    let browser;
    let page;

    try {
      browser = await launchBrowser(args, browserPath, userDataDir);
      page = await browser.newPage();
      page.setDefaultTimeout(config.timeout);
      await page.goto(`${config.developerPreviewBasicUrl}${config.developerPreviewUrl[sample]}`, {
        waitUntil: "networkidle0"
      });

      for (let _backend in config[source][sample]) {
        if (!["cpu", "gpu", "npu"].includes(_backend)) continue;
        for (let _dataType in config[source][sample][_backend]) {
          for (let _model of config[source][sample][_backend][_dataType]) {
            console.log(`${type} ${source} ${sample} ${_backend} ${_dataType} ${_model} testing...`);
            const screenshotFilename = `${source}_${type}_${sample}_${_backend}_${_dataType}_${_model}`;
            try {
              await Promise.race([
                (async () => {
                  await page.click(pageElement[_backend]);
                  await page.click(pageElement[_model]);
                  await util.waitForElementEnabled(page, pageElement.classifyButton);
                  await page.click(pageElement.classifyButton);
                  await page.waitForSelector(pageElement.result, { visible: true });
                })(),
                util.throwOnDevelopmentPreviewError(page, pageElement.alertWaring)
              ]);

              const { performanceResults, imageResults } = await getPageResults(page);
              Object.entries(performanceResults).forEach(([_metric, _value]) => {
                _.set(results, [type + "_" + sample, _backend, _dataType, _model, _metric], _value);
              });

              console.log("Test Results: ", performanceResults, imageResults);
              await util.delay(500);
            } catch (error) {
              _.set(
                results,
                [type + "_" + sample, _backend, _dataType, _model, "error"],
                error.message.substring(0, config.errorMsgMaxLength)
              );
              console.warn(error.message);
            } finally {
              await util.saveScreenshot(page, screenshotFilename);
            }
          }
        }
      }
    } catch (error) {
      if (page) {
        await util.saveScreenshot(page, `${source}_$${type}_${sample}}`);
      }
      console.warn(`${source} $${type} ${sample}: error occurred during launch browser with puppeteer. Error: `, error);
      for (let _backend in config[source][sample]) {
        if (!["cpu", "gpu", "npu"].includes(_backend)) continue;
        for (let _dataType in config[source][sample][_backend]) {
          for (let _model of config[source][sample][_backend][_dataType]) {
            _.set(
              results,
              [type + "_" + sample, backend, _dataType, _model, "error"],
              error.message.substring(0, config.errorMsgMaxLength)
            );
          }
        }
      }
    } finally {
      if (browser) await browser.close();
    }
  };

  // 0. loop to open new page for each test
  if (backend && dataType && model) {
    await testExecution(backend, dataType, model);
  } else {
    for (let _backend in config[source][sample]) {
      if (!["cpu", "gpu", "npu"].includes(_backend)) continue;
      for (let _dataType in config[source][sample][_backend]) {
        for (let _model of config[source][sample][_backend][_dataType]) {
          await testExecution(_backend, _dataType, _model);
        }
      }
    }
  }

  // 1. loop to open new page for each test but classify multiple times (5 times currently)
  for (let _backend in config[source][sample]) {
    if (!["cpu", "gpu", "npu"].includes(_backend)) continue;
    for (let _dataType in config[source][sample][_backend]) {
      for (let _model of config[source][sample][_backend][_dataType]) {
        await repeatInferenceInOnePage(_backend, _dataType, _model);
      }
    }
  }

  // 2. just open one page and loop to switch backends and models
  await switchBackendAndModels();

  return results;
}

module.exports = imageClassificationPreviewTest;

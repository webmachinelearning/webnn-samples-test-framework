/**
 * Test different samples in the same browser tab
 * Supported Sample list: image_classification, fast_style_transfer, object_detection
 */
const puppeteer = require("puppeteer");
const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");
const path = require("path");
const config = require("../../../config.json");

async function switchSampleTest() {
  let totalResults = {};

  const source = "samples";
  const sampleTest = "switchSampleTest";
  const args = util.getBrowserArgs();
  const { browserPath, userDataDir } = util.getBrowserPath(config.browser);
  const expectedCanvas = path.join(path.resolve(__dirname), "../../../assets/canvas");
  totalResults[sampleTest] = {};

  console.log(`${source} ${sampleTest} testing...`);
  // launch the browser
  let browser = await puppeteer.launch({
    headless: config.headless,
    defaultViewport: null,
    args,
    executablePath: browserPath,
    ignoreHTTPSErrors: true,
    protocolTimeout: config["timeout"],
    userDataDir
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(config["timeout"]);

  // navigate the page to sample
  for (const sample of config[source][sampleTest]["order"]) {
    switch (sample) {
      case "imageClassification":
        _.merge(totalResults[sampleTest], await imageClassificationTest());
        break;
      case "fastStyleTransfer":
        _.merge(totalResults[sampleTest], await fastStyleTransferTest());
        break;
      case "objectDetection":
        _.merge(totalResults[sampleTest], await objectDetectionTest());
        break;
      default:
        console.log("Not support this sample:", sample);
    }
  }

  await browser.close();
  return totalResults;

  async function imageClassificationTest() {
    const _sample = "imageClassification";
    let results = {};

    for (let _backend in config[source][sampleTest]["samples"][_sample]) {
      if (!["cpu", "gpu", "npu"].includes(_backend)) {
        continue;
      }

      for (let _dataType in config[source][sampleTest]["samples"][_sample][_backend]) {
        for (let _model of config[source][sampleTest]["samples"][_sample][_backend][_dataType]) {
          const screenshotFilename = `${source}_${sampleTest}_${_sample}_${_backend}_${_dataType}_${_model}`;
          let errorMsg = "";

          try {
            console.log(`${source} ${sampleTest} ${_sample} ${_backend} ${_dataType} ${_model} testing...`);

            await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][_sample]}`, {
              waitUntil: "networkidle0"
            });

            await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
            const elementsToClick = [pageElement[_backend], pageElement[_dataType], pageElement[_model]];

            for (const selector of elementsToClick) {
              await util.clickElementIfEnabled(page, selector);
            }

            // wait for model running results
            try {
              await page.waitForSelector(pageElement["computeTime"], {
                visible: true
              });
            } catch (error) {
              errorMsg += `[PageTimeout]`;
              throw error;
            }

            // get results
            const loadTime = await page.$eval(pageElement["loadTime"], (el) => el.textContent);
            const buildTime = await page.$eval(pageElement["buildTime"], (el) => el.textContent);
            const computeTime = await page.$eval(pageElement["computeTime"], (el) => el.textContent);

            const label0 = await page.$eval(pageElement["label0"], (el) => el.textContent);
            const prob0 = await page.$eval(pageElement["prob0"], (el) => el.textContent);
            const label1 = await page.$eval(pageElement["label1"], (el) => el.textContent);
            const prob1 = await page.$eval(pageElement["prob1"], (el) => el.textContent);
            const label2 = await page.$eval(pageElement["label2"], (el) => el.textContent);
            const prob2 = await page.$eval(pageElement["prob2"], (el) => el.textContent);

            // set results
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
              error: errorMsg
            };

            pageResults = util.replaceEmptyData(pageResults);
            console.log("Test Results: ", pageResults);

            _.set(results, [_sample, _backend, _dataType, _model, "inferenceTime"], pageResults.inferenceTime);
            await util.saveScreenshot(page, screenshotFilename);
          } catch (error) {
            errorMsg += error.message;
            if (page) {
              await util.saveScreenshot(page, screenshotFilename);
              errorMsg += await util.getAlertWarning(page, pageElement.alertWaring);
            }
            console.warn(errorMsg);
          } finally {
            _.set(
              results,
              [_sample, _backend, _dataType, _model, "error"],
              errorMsg.substring(0, config.errorMsgMaxLength)
            );
          }
        }
      }
    }

    return results;
  }

  async function fastStyleTransferTest() {
    const _sample = "fastStyleTransfer";
    let results = {};

    for (let _backend in config[source][sampleTest]["samples"][_sample]) {
      if (!["cpu", "gpu", "npu"].includes(_backend)) {
        continue;
      }

      for (let _dataType in config[source][sampleTest]["samples"][_sample][_backend]) {
        for (let _model of config[source][sampleTest]["samples"][_sample][_backend][_dataType]) {
          let errorMsg = "";

          const screenshotFilename = `${source}_${sampleTest}_${_sample}_${_backend}_${_dataType}_${_model}`;
          console.log(`${source} ${sampleTest} ${_sample} ${_backend} ${_dataType} ${_model} testing...`);

          try {
            await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][_sample]}`, {
              waitUntil: "networkidle0"
            });

            await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);

            for (const example of config[source][sampleTest]["samples"][_sample]["examples"]) {
              const elementsToClick = [pageElement[_backend], pageElement[example]];
              for (const selector of elementsToClick) {
                await util.clickElementIfEnabled(page, selector);
              }

              try {
                await page.waitForSelector(pageElement["computeTime"], {
                  visible: true
                });
              } catch (error) {
                errorMsg += `[PageTimeout]`;
                throw error;
              }

              const computeTime = await page.$eval(pageElement["computeTime"], (el) => el.textContent);

              let compareImagesResults = 0;
              try {
                const canvasImageName = `${sampleTest}_${_sample}_${_backend}_${_dataType}_${_model}`;
                const saveCanvasResult = await util.saveCanvasImage(
                  page,
                  pageElement.fastStyleTransferOutputCanvas,
                  canvasImageName
                );

                // compare canvas to expected canvas
                const expectedCanvasPath = `${expectedCanvas}/fast-style-transfer/${_sample}_${example}_output.png`;
                compareImagesResults = util.compareImages(saveCanvasResult.canvasPath, expectedCanvasPath);
              } catch (error) {
                console.log(error);
              }

              console.log("Compare images results: ", compareImagesResults);
              if (compareImagesResults < 80) {
                errorMsg += "Image result is not the same as template, please check saved images.";
              }

              let pageResults = {
                inferenceTime: util.formatTimeResult(computeTime)
              };
              console.log("Test Results: ", pageResults);

              _.set(results, [_sample, _backend, _dataType, _model], pageResults);
            }
          } catch (error) {
            errorMsg = error.message;
            if (page) {
              await util.saveScreenshot(page, screenshotFilename);
              errorMsg += await util.getAlertWarning(page, pageElement.alertWaring);
            }
            console.warn(errorMsg);
          } finally {
            _.set(
              results,
              [_sample, _backend, _dataType, _model, "error"],
              errorMsg.substring(0, config.errorMsgMaxLength)
            );
          }
        }
      }
    }

    return results;
  }

  async function objectDetectionTest() {
    const _sample = "objectDetection";
    let results = {};

    for (let _backend in config[source][sampleTest]["samples"][_sample]) {
      if (!["cpu", "gpu", "npu"].includes(_backend)) {
        continue;
      }
      for (let _dataType in config[source][sampleTest]["samples"][_sample][_backend]) {
        for (let _model of config[source][sampleTest]["samples"][_sample][_backend][_dataType]) {
          let errorMsg = "";
          const screenshotFilename = `${source}_${sampleTest}_${_sample}_${_backend}_${_dataType}_${_model}`;

          try {
            console.log(`${source} ${sampleTest} ${_sample} ${_backend} ${_dataType} ${_model} testing...`);

            // navigate the page to a URL
            await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][_sample]}`, {
              waitUntil: "networkidle0"
            });

            // wait for page text display
            await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
            // choose backend and model
            const elementsToClick = [pageElement[_backend], pageElement[_dataType], pageElement[_model]];
            for (const selector of elementsToClick) {
              await util.clickElementIfEnabled(page, selector);
            }

            // wait for model running results
            try {
              await page.waitForSelector(pageElement["computeTime"], {
                visible: true
              });
            } catch (error) {
              throw error;
            }

            // save canvas image
            let compareImagesResults = 0;
            try {
              const canvasImageName = `${sampleTest}_${_sample}_${_backend}_${_dataType}_${_model}`;
              const saveCanvasResult = await util.saveCanvasImage(
                page,
                pageElement.objectDetectionCanvas,
                canvasImageName
              );

              // compare canvas to expected canvas
              const expectedCanvasPath = `${expectedCanvas}/${_sample}_${_model}.png`;
              compareImagesResults = util.compareImages(saveCanvasResult.canvasPath, expectedCanvasPath);

              console.log("Compare images results with the template image:", compareImagesResults);

              if (compareImagesResults < 95) {
                errorMsg += "Image result is not the same as template, please check saved images.";
              }
            } catch (error) {
              throw error;
            }

            // get results
            const loadTime = await page.$eval(pageElement["loadTime"], (el) => el.textContent);
            const buildTime = await page.$eval(pageElement["buildTime"], (el) => el.textContent);
            const computeTime = await page.$eval(pageElement["computeTime"], (el) => el.textContent);

            // set results
            let pageResults = {
              loadTime: util.formatTimeResult(loadTime),
              buildTime: util.formatTimeResult(buildTime),
              inferenceTime: util.formatTimeResult(computeTime),
              compareImagesResults,
              error: errorMsg
            };

            pageResults = util.replaceEmptyData(pageResults);
            console.log("Test results: ", pageResults);

            _.set(results, [_sample, _backend, _dataType, _model, "inferenceTime"], pageResults.inferenceTime);

            await util.saveScreenshot(page, screenshotFilename);
          } catch (error) {
            errorMsg = error.message;
            if (page) {
              await util.saveScreenshot(page, screenshotFilename);
              errorMsg += await util.getAlertWarning(page, pageElement.alertWaring);
            }
            console.warn(errorMsg);
          } finally {
            _.set(
              results,
              [_sample, _backend, _dataType, _model, "error"],
              errorMsg.substring(0, config.errorMsgMaxLength)
            );
          }
        }
      }
    }

    return results;
  }
}

module.exports = switchSampleTest;

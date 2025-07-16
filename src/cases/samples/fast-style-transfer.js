const puppeteer = require("puppeteer");
const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");
const path = require("path");
const config = require("../../../config.json");

async function fastStyleTransferTest({ backend, dataType, model } = {}) {
  const source = "samples";
  const sample = "fastStyleTransfer";
  const results = {};
  const expectedCanvas = path.join(path.resolve(__dirname), "../../../assets/canvas/fast-style-transfer");

  const testExecution = async (backend, dataType, model) => {
    if (!["cpu", "gpu", "npu"].includes(backend)) {
      console.warn(`Invalid backend: ${backend}`);
      return;
    }

    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);
    // set browser args, browser path
    const args = util.getBrowserArgs(backend);
    const { browserPath, userDataDir } = util.getBrowserPath(config.browser);
    const screenshotFilename = `${source}_${sample}_${backend}_${dataType}_${model}`;
    let errorMsg = "";
    let browser;
    let page;

    try {
      // launch the browser
      browser = await puppeteer.launch({
        headless: config.headless,
        defaultViewport: null,
        args,
        executablePath: browserPath,
        ignoreHTTPSErrors: true,
        protocolTimeout: config["timeout"],
        userDataDir
      });

      page = await browser.newPage();
      page.setDefaultTimeout(config["timeout"]);
      await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][sample]}`, {
        waitUntil: "networkidle0"
      });
      await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);

      for (const example of config[source][sample]["examples"]) {
        const elementsToClick = [pageElement[backend], pageElement[example]];
        for (const selector of elementsToClick) {
          await util.clickElementIfEnabled(page, selector);
        }

        await Promise.race([
          page.waitForSelector(pageElement["computeTime"], { visible: true }),
          util.throwErrorOnElement(page, pageElement.alertWarning)
        ]);

        const computeTime = await page.$eval(pageElement["computeTime"], (el) => el.textContent);

        let compareImageInputResults = 0;
        let compareImagesOutputResults = 0;
        try {
          // compare the selected image of sample, throw error if the default image changed

          const saveCanvasImageInputResult = await util.saveCanvasImage(
            page,
            pageElement.fastStyleTransferInputCanvas,
            `${sample}_${example}_input`
          );

          // compare canvas to expected input canvas
          compareImageInputResults = util.compareImages(
            saveCanvasImageInputResult.canvasPath,
            `${expectedCanvas}/${sample}_${example}_input.png`
          );

          if (compareImageInputResults < 95) {
            throw new Error(
              "Input image canvas is not the same as template. Please check if default selected image changes."
            );
          }

          const canvasImageName = `${sample}_${example}_output`;
          const saveCanvasResult = await util.saveCanvasImage(
            page,
            pageElement.fastStyleTransferOutputCanvas,
            canvasImageName
          );

          // compare canvas to expected canvas
          const expectedCanvasPath = `${expectedCanvas}/${sample}_${example}_output.png`;
          compareImagesOutputResults = util.compareImages(saveCanvasResult.canvasPath, expectedCanvasPath);
        } catch (error) {
          console.log(error);
        }

        console.log("Compare images results: ", compareImagesOutputResults);
        if (compareImagesOutputResults < 80) {
          errorMsg += "Image result is not the same as template, please check saved images.";
        }

        let pageResults = {
          inferenceTime: util.formatTimeResult(computeTime)
        };
        console.log("Test Results: ", pageResults);

        _.set(results, [sample, backend, dataType, model], pageResults);
      }
    } catch (error) {
      errorMsg = error.message;
      if (page) {
        await util.saveScreenshot(page, screenshotFilename);
      }
      console.warn(errorMsg);
    } finally {
      _.set(results, [sample, backend, dataType, model, "error"], errorMsg.substring(0, config.errorMsgMaxLength));
      if (browser) await browser.close();
    }
  };
  // execute exact single sample with
  if (backend && dataType && model) {
    await testExecution(backend, dataType, model);
  } else {
    for (let _backend in config[source][sample]) {
      // only loop the valid backends objects
      if (!["cpu", "gpu", "npu"].includes(_backend)) {
        continue;
      }
      for (let _dataType in config[source][sample][_backend]) {
        for (let _model of config[source][sample][_backend][_dataType]) {
          await testExecution(_backend, _dataType, _model);
        }
      }
    }
  }
  return results;
}

module.exports = fastStyleTransferTest;

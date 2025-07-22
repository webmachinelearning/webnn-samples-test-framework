const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");
const path = require("path");
const config = require("../../../config.json");

async function facialLandmarkDetectionTest({ backend, dataType, model } = {}) {
  const source = "samples";
  const sample = "facialLandmarkDetection";
  const validFaceLandmarkDetectionArray = ["simpleCnn"];
  const expectedCanvas = path.join(path.resolve(__dirname), "../../../assets/canvas");
  const results = {};

  const testExecution = async (backend, dataType, model) => {
    if (!["cpu", "gpu", "npu"].includes(backend)) {
      console.warn(`Invalid backend: ${backend}`);
      return;
    }

    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);

    const screenshotFilename = `${source}_${sample}_${backend}_${dataType}_${model}`;

    // simpleCnnSsdMobileNetV2Face ->  simpleCnn
    const facialLandmark = validFaceLandmarkDetectionArray.find((name) => model.startsWith(name));
    // simpleCnnSsdMobileNetV2Face -> ssdMobileNetV2Face
    const modelName =
      model.replace(`${facialLandmark}`, "").charAt(0).toLowerCase() + model.replace(`${facialLandmark}`, "").slice(1);
    let errorMsg = "";
    let browser;
    let page;

    try {
      browser = await util.launchBrowser(config, backend);
      page = await browser.newPage();
      page.setDefaultTimeout(config["timeout"]);
      await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][sample]}`, {
        waitUntil: "networkidle0"
      });
      await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);

      const elementsToClick = [pageElement[backend], pageElement[facialLandmark], pageElement[modelName]];
      for (const selector of elementsToClick) {
        await util.clickElementIfEnabled(page, selector);
      }

      // wait for model running results
      await Promise.race([
        page.waitForSelector(pageElement["computeTime"], { visible: true }),
        util.throwErrorOnElement(page, pageElement.alertWarning)
      ]);

      const computeTime = await page.$eval(pageElement["computeTime"], (el) => el.textContent);

      // save canvas image
      let compareImagesResults = 0;
      try {
        const canvasImageName = `${sample}_${backend}_${facialLandmark}_${modelName}`;
        const saveCanvasResult = await util.saveCanvasImage(
          page,
          pageElement.facialLandmarkDetectionCanvas,
          canvasImageName
        );
        // compare canvas to expected canvas
        const expectedCanvasPath = `${expectedCanvas}/${sample}_${model}.png`;
        compareImagesResults = util.compareImages(saveCanvasResult.canvasPath, expectedCanvasPath);

        console.log("Compare images results with the template image:", compareImagesResults);

        if (compareImagesResults < 95) {
          errorMsg += "Image result is not the same as template, please check saved images.";
        }
      } catch (error) {
        errorMsg += error.message;
        throw error;
      }

      // set results
      let pageResults = {
        inferenceTime: util.formatTimeResult(computeTime),
        error: errorMsg
      };

      console.log("Test Results: ", pageResults);
      _.set(results, [sample, backend, dataType, model], pageResults);
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

module.exports = facialLandmarkDetectionTest;

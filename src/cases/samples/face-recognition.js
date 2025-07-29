const util = require("../../utils/util.js");
const pageElement = require("../../page-elements/samples.js");
const _ = require("lodash");
const path = require("path");

async function faceRecognitionTest({ config, backend, dataType, model } = {}) {
  const source = "samples";
  const sample = "face-recognition";
  const validFaceRecognitionArray = ["faceNet"];
  const results = {};

  const expectedCanvas = path.join(path.resolve(__dirname), "../../../assets/canvas");

  const testExecution = async (backend, dataType, model) => {
    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);

    // faceNetSsdMobileNetV2Face -> faceNet
    const faceRecognition = validFaceRecognitionArray.find((name) => model.startsWith(name));
    // faceNetSsdMobileNetV2Face -> ssdMobileNetV2Face
    const modelName =
      model.replace(`${faceRecognition}`, "").charAt(0).toLowerCase() +
      model.replace(`${faceRecognition}`, "").slice(1);
    const screenshotFilename = `${source}_${sample}_${backend}_${dataType}_${model}`;
    let errorMsg = "";
    let browser;
    let page;

    try {
      browser = await util.launchBrowser(config);
      // open a new page
      page = await browser.newPage();
      // set the default timeout time for the page
      page.setDefaultTimeout(config["timeout"]);

      // navigate the page to a URL
      await page.goto(`${config["samplesBasicUrl"]}${config["samplesUrl"][sample]}`, {
        waitUntil: "networkidle0"
      });

      // wait for page text display
      await page.waitForSelector(`::-p-xpath(${pageElement.backendText})`);

      // choose backend and model
      const elementsToClick = [pageElement[backend], pageElement[faceRecognition], pageElement[modelName]];
      for (const selector of elementsToClick) {
        await util.clickElementIfEnabled(page, selector);
      }

      // wait for model running results
      await Promise.race([
        page.waitForSelector(pageElement["computeTime"], { visible: true }),
        util.throwErrorOnElement(page, pageElement.alertWarning)
      ]);

      // get results
      const buildTime = await page.$eval(pageElement.buildTime, (el) => el.textContent);
      const computeTime = await page.$eval(pageElement["computeTime"], (el) => el.textContent);

      // save canvas image
      let compareImagesResultsTarget,
        compareImagesResultsSearch = 0;
      try {
        const canvasImageNameTarget = `${sample}_${backend}_${faceRecognition}_${modelName}_target`;
        const canvasImageNameSearch = `${sample}_${backend}_${faceRecognition}_${modelName}_search`;

        const saveCanvasResultTarget = await util.saveCanvasImage(
          page,
          pageElement.faceRecognitionTargetCanvas,
          canvasImageNameTarget
        );
        const saveCanvasResultSearch = await util.saveCanvasImage(
          page,
          pageElement.faceRecognitionSearchCanvas,
          canvasImageNameSearch
        );

        // compare canvas to expected canvas
        const expectedCanvasPathTarget = `${expectedCanvas}/${sample}_${faceRecognition}_${modelName}_target.png`;
        compareImagesResultsTarget = util.compareImages(saveCanvasResultTarget.canvasPath, expectedCanvasPathTarget);

        // compare canvas to expected canvas
        const expectedCanvasPathSearch = `${expectedCanvas}/${sample}_${faceRecognition}_${modelName}_search.png`;
        compareImagesResultsSearch = util.compareImages(saveCanvasResultSearch.canvasPath, expectedCanvasPathSearch);

        console.log("Compare search images results: ", compareImagesResultsSearch);
        console.log("Compare target images results: ", compareImagesResultsTarget);

        if (compareImagesResultsSearch < 95) {
          errorMsg += "Search Image result is not the same as template, please check saved images.";
        }
        if (compareImagesResultsSearch < 95) {
          errorMsg += "Target Image result is not the same as template, please check saved images.";
        }
      } catch (error) {
        errorMsg += error.message;
        throw error;
      }

      // set results
      let pageResults = {
        buildTime: util.formatTimeResult(buildTime),
        inferenceTime: util.formatTimeResult(computeTime),
        error: errorMsg
      };
      _.set(results, [sample, backend, dataType, model], pageResults);
    } catch (error) {
      errorMsg += error.message;
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

module.exports = faceRecognitionTest;

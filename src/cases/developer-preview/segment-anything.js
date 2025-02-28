const puppeteer = require("puppeteer");
const util = require("../../utils/util.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");
const _ = require("lodash");
const config = require("../../../config.json");

async function segmentAnythingTest({ backend, dataType, model } = {}) {
  const source = "developerPreview";
  const sample = "segmentAnything";
  let results = {};

  const pageElement = pageElementTotal[sample];
  const modelArray = ["encoder", "decoder"];

  const testExecution = async (backend, dataType, model = "") => {
    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);

    const screenshotFilename = model
      ? `${source}_${sample}_${backend}_${dataType}_${model}`
      : `${source}_${sample}_${backend}_${dataType}`;

    // set browser args, browser path
    const args = util.getBrowserArgs(backend);
    const { browserPath, userDataDir } = util.getBrowserPath(config.browser);
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

      const urlArguments = config[source][sample]["urlArgs"][backend];
      await page.goto(`${config["developerPreviewBasicUrl"]}${config["developerPreviewUrl"][sample]}${urlArguments}`, {
        waitUntil: "networkidle0"
      });

      // wait model load complete
      await page.waitForSelector(pageElement["imgCanvas"], {
        visible: true
      });
      // get canvas image location
      const imageRect = await page.evaluate((pageElement) => {
        const imageElement = document.querySelector(pageElement["imgCanvas"]);
        const imageObj = imageElement.getBoundingClientRect();
        return JSON.parse(JSON.stringify(imageObj));
      }, pageElement);

      // move the mouse to a random spot of canvas image
      let spotX = config[source][sample]["imageSpot"]["x"];
      let spotY = config[source][sample]["imageSpot"]["y"];
      let x = Math.floor(spotX * imageRect.width) + imageRect.left;
      let y = Math.floor(spotY * imageRect.height) + imageRect.top;
      // click the spot of canvas image
      await page.mouse.click(x, y);
      // wait results appear
      await page.waitForSelector(pageElement["decoderLatency"], {
        visible: true
      });

      let samDecoderTime = "";
      let checkCount = 60;

      for (let i = 0; i < checkCount; i++) {
        samDecoderTime = await page.$eval(pageElement["decoderLatency"], (el) => el.textContent);
        if (samDecoderTime) break;
        await util.delay(1000);
      }

      if (!samDecoderTime) {
        throw new Error("[PageTimeout]");
      }

      const encoderTime = await page.$eval(pageElement["logPanel"], (el) => {
        const matches = el.textContent.match(/Encoder execution time: (\d+\.?\d*)ms/g);
        if (matches && matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          const timeMatch = lastMatch.match(/(\d+\.?\d*)ms/);
          return timeMatch ? timeMatch[1].toString() : "";
        }
        return "";
      });

      if (model) {
        _.set(
          results,
          [sample, backend, dataType, model, "inferenceTime"],
          model === "encoder" ? encoderTime : samDecoderTime
        );
      } else {
        _.set(results, [sample, backend, dataType, "encoder", "inferenceTime"], encoderTime);
        _.set(results, [sample, backend, dataType, "decoder", "inferenceTime"], samDecoderTime);
      }

      console.log("Test Results: ", samDecoderTime);
    } catch (error) {
      errorMsg += error.message;
      if (page) {
        await util.saveScreenshot(page, screenshotFilename);
      }
      console.warn(error);
    } finally {
      // currently save the same error content for each model
      if (model) {
        _.set(results, [sample, backend, dataType, model, "error"], errorMsg.substring(0, config.errorMsgMaxLength));
      } else {
        for (let _model of modelArray) {
          _.set(results, [sample, backend, dataType, _model, "error"], errorMsg.substring(0, config.errorMsgMaxLength));
        }
      }
      if (browser) await browser.close();
    }
  };

  if ((backend, dataType, model)) {
    await testExecution(backend, dataType, model);
  } else {
    for (let _backend in config[source][sample]) {
      if (!["cpu", "gpu", "npu"].includes(_backend)) {
        continue;
      }
      for (let _dataType in config[source][sample][_backend]) {
        await testExecution(_backend, _dataType);
      }
    }
  }

  return results;
}

module.exports = segmentAnythingTest;

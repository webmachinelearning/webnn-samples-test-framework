const util = require("../../utils/util.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");
const _ = require("lodash");

async function segmentAnythingTest({ config, backend, dataType, model } = {}) {
  const source = "developer-preview";
  const sample = "segment-anything";
  const pageElement = pageElementTotal[sample];

  const testExecution = async (backend, dataType, model = "") => {
    let result = {};
    console.log(`${source} ${sample} ${backend} ${dataType} ${model} testing...`);

    const screenshotFilename = model
      ? `${source}_${sample}_${backend}_${dataType}_${model}`
      : `${source}_${sample}_${backend}_${dataType}`;
    let browser;
    let page;

    try {
      browser = await util.launchBrowser(config);
      page = (await browser.pages())[0];
      page.setDefaultTimeout(config["timeout"]);

      const urlArguments = config[source][sample]["urlArgs"][backend];
      await page.goto(`${config["developerPreviewBasicUrl"]}${config["developerPreviewUrl"][sample]}${urlArguments}`, {
        waitUntil: "networkidle0"
      });

      // wait model load complete
      await Promise.race([
        page.waitForSelector(pageElement["imgCanvas"], { visible: true }),
        util.throwOnUncaughtException(page)
      ]);

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
      await page.waitForSelector(pageElement.decoderLatency, { visible: true });
      await page.waitForFunction(
        async (pageElement) => document.querySelector(pageElement.decoderLatency)?.textContent,
        {},
        pageElement
      );
      const log = await page.$eval(pageElement.logPanel, (el) => el.textContent);
      result = {
        encoder: {
          buildTime: log.match(/SAM ViT-B Encoder \(FP(?:16|32)\) create time: (\d+\.?\d*)ms/)[1],
          inferenceTime: log.match(/Encoder execution time: (\d+\.?\d*)ms/)[1]
        },
        decoder: {
          buildTime: log.match(/SAM ViT-B Decoder \(FP(?:16|32)\) create time: (\d+\.?\d*)ms/)[1],
          inferenceTime: await page.$eval(pageElement.decoderLatency, (el) => el.textContent)
        }
      };
      console.log("Test Results: ", result);
    } catch (error) {
      result = { encoder: { error: error.message }, decoder: { error: error.message } };
      console.warn(error);
    } finally {
      if (page) await util.saveScreenshot(page, screenshotFilename);
      if (browser) await browser.close();
    }
    if (model) {
      return { [model]: result[model] };
    } else {
      return result;
    }
  };

  let results = {};
  if (backend && dataType) {
    _.set(results, [sample, backend, dataType], await testExecution(backend, dataType, model));
  } else {
    for (let _backend in config[source][sample]) {
      if (!["cpu", "gpu", "npu"].includes(_backend)) {
        continue;
      }
      for (let _dataType in config[source][sample][_backend]) {
        _.set(results, [sample, _backend, _dataType], await testExecution(_backend, _dataType));
      }
    }
  }

  return results;
}

module.exports = segmentAnythingTest;

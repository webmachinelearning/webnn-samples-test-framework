const puppeteer = require("puppeteer");
const util = require("../../utils/util.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");
const _ = require("lodash");
const path = require("path");
const config = require("../../../config.json");
const processInfo = require("../../utils/process.js");

async function whisperBaseTest({ backend, dataType, model } = {}) {
  let source = "developerPreview";
  let sample = "whisperBase";
  let results = {};

  const pageElement = pageElementTotal[sample];
  const browserProcess = util.getBrowserProcess();
  const modelNameArray = ["encoder", "decoder", "decoderKvCache"];

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
      // open a new page
      page = await browser.newPage();
      // set the default timeout time for the page
      page.setDefaultTimeout(config["timeout"]);

      const urlArguments = config[source][sample]["urlArgs"][backend];
      await page.goto(`${config["developerPreviewBasicUrl"]}${config["developerPreviewUrl"][sample]}${urlArguments}`);

      try {
        let rendererProcessInfo = processInfo.getRendererProcessInfo(browserProcess);
        _.set(
          results,
          [sample, backend, dataType, "privateMemoryRendererBefore"],
          rendererProcessInfo.PagedMemorySize64 ?? rendererProcessInfo.VmRSSKb ?? rendererProcessInfo.error
        );
        let gpuProcessInfo = processInfo.getGpuProcessInfo(browserProcess);
        _.set(
          results,
          [sample, backend, dataType, "privateMemoryGpuBefore"],
          gpuProcessInfo.PagedMemorySize64 ?? gpuProcessInfo.VmRSSKb ?? gpuProcessInfo.error
        );

        // wait for the source load finished (record button enabled)
        await util.waitForElementEnabled(page, pageElement["recordButton"]);

        // save finished memory data
        rendererProcessInfo = processInfo.getRendererProcessInfo(browserProcess);
        _.set(
          results,
          [sample, backend, dataType, "privateMemoryRendererAfter"],
          rendererProcessInfo.PagedMemorySize64 ?? rendererProcessInfo.VmRSSKb ?? rendererProcessInfo.error
        );
        _.set(
          results,
          [sample, backend, dataType, "privateMemoryRendererPeak"],
          rendererProcessInfo.PeakPagedMemorySize64 ?? rendererProcessInfo.VmHWMKb ?? rendererProcessInfo.error
        );

        gpuProcessInfo = processInfo.getGpuProcessInfo(browserProcess);
        _.set(
          results,
          [sample, backend, dataType, "privateMemoryGpuAfter"],
          gpuProcessInfo.PagedMemorySize64 ?? gpuProcessInfo.VmRSSKb ?? gpuProcessInfo.error
        );
        _.set(
          results,
          [sample, backend, dataType, "privateMemoryGpuPeak"],
          gpuProcessInfo.PeakPagedMemorySize64 ?? gpuProcessInfo.VmHWMKb ?? gpuProcessInfo.error
        );

        // upload an audio
        const inputElement = await page.$(pageElement["uploadInput"]);
        const audioPath = path.join(
          path.resolve(__dirname),
          `../../../assets/audio/${config[source][sample]["examples"][0].name}`
        );

        await inputElement.uploadFile(audioPath);
        // wait for the results show (record_button enabled)
        await util.waitForElementEnabled(page, pageElement["recordButton"]);
      } catch (error) {
        error.message = `[PageTimeout]`;
        throw error;
      }

      // get results
      const outputText = await page.$eval(pageElement["outputText"], (el) => el.textContent);
      const expectedText = config[source][sample]["examples"][0].expectedValue;

      if (outputText !== expectedText) {
        errorMsg = `Output text: ${outputText}, which is not the same as expected.`;
        throw error;
      }

      const latency = await page.$eval(pageElement["latency"], (el) => el.textContent);
      let xRealtime = parseFloat(latency.match(/([\d.]+)\s*x\s*realtime/)[1]);
      let timeToFirstToken = parseFloat(latency.match(/time to first token:\s*([\d.]+)ms/)[1]);
      let tokensPerSecond = parseFloat(latency.match(/([\d.]+)\s*tokens\/s/)[1]);

      console.log(`Test results- realtime:${xRealtime}, timeToFirstToken:${timeToFirstToken} `);

      if (model) {
        _.set(results, [sample, backend, dataType, model, "tokensPerSecond"], tokensPerSecond);
      } else {
        for (let _model of modelNameArray) {
          _.set(results, [sample, backend, dataType, _model, "tokensPerSecond"], tokensPerSecond);
        }
      }
    } catch (error) {
      errorMsg += error.message;
      if (page) {
        await util.saveScreenshot(page, screenshotFilename);
      }
    } finally {
      if (model) {
        _.set(results, [sample, backend, dataType, model, "error"], errorMsg.substring(0, config.errorMsgMaxLength));
      } else {
        for (let _model of modelNameArray) {
          _.set(results, [sample, backend, dataType, _model, "error"], errorMsg.substring(0, config.errorMsgMaxLength));
        }
      }

      if (browser) await browser.close();
    }
  };

  if (backend && dataType && model) {
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

module.exports = whisperBaseTest;

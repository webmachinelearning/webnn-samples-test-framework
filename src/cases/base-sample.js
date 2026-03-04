const util = require("../utils/util.js");
const _ = require("lodash");

/**
 * Base class for all sample tests.
 * Provides common functionality for browser management, result handling, and navigation.
 * Subclasses must implement run() and navigate().
 */
class BaseSample {
  constructor(config, source, sample) {
    this.config = config;
    this.source = source;
    this.sample = sample;
    this.sampleConfig = this.config[this.source][this.sample];
  }

  /**
   * Main entry point for running tests
   * @param {string} [backend] - Optional backend filter
   * @param {string} [dataType] - Optional dataType filter
   * @param {string} [model] - Optional model filter
   */
  async execute(backend, dataType, model) {
    const key = this.resultKey || this.sample;
    if (backend && dataType && model) {
      const result = await this.runCase(backend, dataType, model);
      if (model === "all" && typeof result === "object") {
        return _.set({}, [key, backend, dataType], result);
      }
      return _.set({}, [key, backend, dataType, model], result);
    } else {
      return await this.runCases();
    }
  }

  /**
   * Run all test cases by iterating through config
   */
  async runCases() {
    const key = this.resultKey || this.sample;
    let results = {};
    for (let backend in this.sampleConfig) {
      if (!["cpu", "gpu", "npu"].includes(backend)) continue;
      for (let dataType in this.sampleConfig[backend]) {
        for (let model of this.sampleConfig[backend][dataType]) {
          const result = await this.runCase(backend, dataType, model);
          if (model === "all" && typeof result === "object") {
            _.merge(results, _.set({}, [key, backend, dataType], result));
          } else {
            _.merge(results, _.set({}, [key, backend, dataType, model], result));
          }
        }
      }
    }
    return results;
  }

  /**
   * Run a single test case with browser lifecycle management
   */
  async runCase(backend, dataType, model) {
    if (!["cpu", "gpu", "npu"].includes(backend)) {
      console.warn(`Invalid backend: ${backend}`);
      return;
    }

    console.log(`${this.source} ${this.sample} ${backend} ${dataType} ${model} testing...`);
    const screenshotFilename = `${this.source}_${this.sample}_${backend}_${dataType}_${model}`;
    let browser = null;
    let page = null;
    try {
      browser = await util.launchBrowser(this.config);
      page = (await browser.pages())[0];
      page.setDefaultTimeout(this.config.timeout);

      await this.navigate(page, backend, model);

      let result = {};
      if (typeof this.beforeRun === "function") {
        const before = await this.beforeRun(page);
        if (before) result = { ...result, ...before };
      }
      result = { ...result, ...(await this.run(page, backend, dataType, model)) };
      if (typeof this.afterRun === "function") {
        const after = await this.afterRun(page);
        if (after) result = { ...result, ...after };
      }
      return result;
    } catch (error) {
      let errorMessage = error.message;
      try {
        const gpuLogMessages = await BaseSample.getGpuLogMessages(browser);
        const gpuCrashMessages = gpuLogMessages.filter((message) => message.includes("The GPU process crashed!"));
        if (gpuCrashMessages.length > 0) {
          errorMessage = errorMessage + "\n" + gpuCrashMessages.join("\n");
        }
      } catch (_) {
        // Ignore errors when checking chrome://gpu
      }
      console.warn(errorMessage);
      return { error: errorMessage };
    } finally {
      if (page) await util.saveScreenshot(page, screenshotFilename);
      if (browser) await browser.close();
    }
  }

  /**
   * Navigate to the sample page for a given backend/model.
   * Must be implemented by subclasses.
   * @param {import('puppeteer').Page} page
   * @param {string} backend
   * @param {string} model
   */
  async navigate(page, backend, model) {
    throw new Error("navigate() must be implemented");
  }

  /**
   * Run the actual test logic - must be implemented by subclasses
   */
  async run(page, backend, dataType, model) {
    throw new Error("run() must be implemented");
  }

  /**
   * Open chrome://gpu in a new tab and return all log messages.
   * @param {import('puppeteer').Browser} browser
   * @returns {Promise<string[]>}
   */
  static async getGpuLogMessages(browser) {
    const gpuPage = await browser.newPage();
    await gpuPage.goto("chrome://gpu", { waitUntil: "networkidle0" });
    await gpuPage.waitForFunction(() => {
      const infoView = document.querySelector("info-view").shadowRoot;
      return infoView.querySelector("#content > div:last-child > h3 > span:nth-child(2)").innerText === "Log Messages";
    });
    return await gpuPage.evaluate(() => {
      const infoView = document.querySelector("info-view").shadowRoot;
      return Array.from(infoView.querySelectorAll("#content > div:last-child > ul > li")).map((el) => el.innerText);
    });
  }
}

module.exports = BaseSample;

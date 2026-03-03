const util = require("../../utils/util.js");
const _ = require("lodash");
const processInfo = require("../../utils/process.js");
const qs = require("qs");

/**
 * Base class for all sample tests.
 * Provides common functionality for browser management, result handling, and navigation.
 */
class BaseSample {
  constructor(config, sample) {
    this.config = config;
    this.source = "developer-preview";
    this.sampleConfig = this.config[this.source][this.sample];
    this.sample = sample;
    this.recordMemory = false;
  }

  /**
   * Main entry point for running tests
   * @param {string} [backend] - Optional backend filter
   * @param {string} [dataType] - Optional dataType filter
   * @param {string} [model] - Optional model filter
   */
  async execute(backend, dataType, model) {
    if (backend && dataType && model) {
      return _.set({}, [this.sample, backend, dataType, model], await this.runCase(backend, dataType, model));
    } else {
      return await this.runCases();
    }
  }

  /**
   * Run all test cases by iterating through config
   */
  async runCases() {
    let results = {};
    for (let backend in this.sampleConfig) {
      if (!["cpu", "gpu", "npu"].includes(backend)) continue;
      for (let dataType in this.sampleConfig[backend]) {
        for (let model of this.sampleConfig[backend][dataType]) {
          _.merge(
            results,
            _.set({}, [this.sample, backend, dataType, model], await this.runCase(backend, dataType, model))
          );
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
      if (this.recordMemory) {
        const browserProcess = util.getBrowserProcess(this.config);
        const rendererProcessInfo = processInfo.getRendererProcessInfo(browserProcess);
        const gpuProcessInfo = processInfo.getGpuProcessInfo(browserProcess);
        result.privateMemoryRendererBefore =
          rendererProcessInfo.PagedMemorySize64 ?? rendererProcessInfo.VmRSSKb ?? rendererProcessInfo.error;
        result.privateMemoryGpuBefore =
          gpuProcessInfo.PagedMemorySize64 ?? gpuProcessInfo.VmRSSKb ?? gpuProcessInfo.error;
      }

      result = { ...result, ...(await this.run(page, backend, dataType, model)) };

      if (this.recordMemory) {
        const browserProcess = util.getBrowserProcess(this.config);
        const rendererProcessInfo = processInfo.getRendererProcessInfo(browserProcess);
        const gpuProcessInfo = processInfo.getGpuProcessInfo(browserProcess);
        result.privateMemoryRendererAfter =
          rendererProcessInfo.PagedMemorySize64 ?? rendererProcessInfo.VmRSSKb ?? rendererProcessInfo.error;
        result.privateMemoryGpuAfter =
          gpuProcessInfo.PagedMemorySize64 ?? gpuProcessInfo.VmRSSKb ?? gpuProcessInfo.error;
        result.privateMemoryRendererPeak =
          rendererProcessInfo.PeakPagedMemorySize64 ?? rendererProcessInfo.VmHWMKb ?? rendererProcessInfo.error;
        result.privateMemoryGpuPeak =
          gpuProcessInfo.PeakPagedMemorySize64 ?? gpuProcessInfo.VmHWMKb ?? gpuProcessInfo.error;
      }

      return result;
    } catch (error) {
      console.warn(error.message);
      return error.message;
    } finally {
      if (page) await util.saveScreenshot(page, screenshotFilename);
      if (browser) await browser.close();
    }
  }

  /**
   * Navigate to the sample page for a given backend/model.
   * dataType is intentionally not part of navigation URL.
   */
  async navigate(page, backend, model) {
    const sampleConfig = this.config[this.source][this.sample];
    const backendArgs = (sampleConfig.urlArgs && sampleConfig.urlArgs[backend]) || {};
    const modelArgs = (sampleConfig.urlArgs && sampleConfig.urlArgs[model]) || {};
    const urlQuery = qs.stringify({ ...backendArgs, ...modelArgs });
    const baseUrl = `${this.config.developerPreviewBasicUrl}${this.config.developerPreviewUrl[this.sample]}`;
    const url = urlQuery ? `${baseUrl}?${urlQuery}` : baseUrl;
    await page.goto(url, { waitUntil: "networkidle0" });
  }

  /**
   * Run the actual test logic - must be implemented by subclasses
   */
  async run(page, backend, dataType, model) {
    throw new Error("run() must be implemented");
  }
}

module.exports = BaseSample;

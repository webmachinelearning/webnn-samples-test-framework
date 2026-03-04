const BaseSample = require("../base-sample.js");
const util = require("../../utils/util.js");
const processInfo = require("../../utils/process.js");
const qs = require("qs");

/**
 * Base class for developer-preview sample tests.
 * Extends BaseSample, implements navigate() with developer-preview URL/query args,
 * and adds recordMemory logic via beforeRun/afterRun.
 * Supports both (config, sample) and (config, source, sample) for subclasses.
 */
class DeveloperPreviewSample extends BaseSample {
  constructor(config, sampleOrSource, sampleOptional) {
    if (sampleOptional !== undefined) {
      super(config, sampleOrSource, sampleOptional);
    } else {
      super(config, "developer-preview", sampleOrSource);
    }
    this.recordMemory = false;
  }

  async beforeRun(page) {
    if (!this.recordMemory) return null;
    const browserProcess = util.getBrowserProcess(this.config);
    const rendererProcessInfo = processInfo.getRendererProcessInfo(browserProcess);
    const gpuProcessInfo = processInfo.getGpuProcessInfo(browserProcess);
    return {
      privateMemoryRendererBefore:
        rendererProcessInfo.PagedMemorySize64 ?? rendererProcessInfo.VmRSSKb ?? rendererProcessInfo.error,
      privateMemoryGpuBefore:
        gpuProcessInfo.PagedMemorySize64 ?? gpuProcessInfo.VmRSSKb ?? gpuProcessInfo.error
    };
  }

  async afterRun(page) {
    if (!this.recordMemory) return null;
    const browserProcess = util.getBrowserProcess(this.config);
    const rendererProcessInfo = processInfo.getRendererProcessInfo(browserProcess);
    const gpuProcessInfo = processInfo.getGpuProcessInfo(browserProcess);
    return {
      privateMemoryRendererAfter:
        rendererProcessInfo.PagedMemorySize64 ?? rendererProcessInfo.VmRSSKb ?? rendererProcessInfo.error,
      privateMemoryGpuAfter:
        gpuProcessInfo.PagedMemorySize64 ?? gpuProcessInfo.VmRSSKb ?? gpuProcessInfo.error,
      privateMemoryRendererPeak:
        rendererProcessInfo.PeakPagedMemorySize64 ?? rendererProcessInfo.VmHWMKb ?? rendererProcessInfo.error,
      privateMemoryGpuPeak:
        gpuProcessInfo.PeakPagedMemorySize64 ?? gpuProcessInfo.VmHWMKb ?? gpuProcessInfo.error
    };
  }

  /**
   * Navigate to the sample page for a given backend/model.
   * dataType is intentionally not part of navigation URL.
   */
  async navigate(page, backend, model) {
    const backendArgs = (this.urlArgs && this.urlArgs[backend]) || {};
    const modelArgs = (this.urlArgs && this.urlArgs[model]) || {};
    const urlQuery = qs.stringify({ ...backendArgs, ...modelArgs });
    const baseUrl = `${this.config.developerPreviewBasicUrl}${this.config.developerPreviewUrl[this.sample]}`;
    const url = urlQuery ? `${baseUrl}?${urlQuery}` : baseUrl;
    await page.goto(url, { waitUntil: "networkidle0" });
  }
}

module.exports = DeveloperPreviewSample;

const BaseSample = require("../base-sample.js");

/**
 * Base class for samples tests.
 * Extends BaseSample and implements navigate() with samples URL.
 */
class WebNNSample extends BaseSample {
  constructor(config, source, sample) {
    super(config, source, sample);
  }

  /**
   * Navigate to the sample page.
   */
  async navigate(page, backend, model) {
    const url = `${this.config.samplesBasicUrl}${this.config.samplesUrl[this.sample]}`;
    await page.goto(url, { waitUntil: "networkidle0" });
  }
}

module.exports = WebNNSample;

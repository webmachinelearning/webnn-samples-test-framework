const util = require("../../utils/util.js");
const BaseSample = require("./base-sample.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");

class SegmentAnything extends BaseSample {
  constructor(config) {
    super(config, "segment-anything");
  }

  async run(page, backend, dataType, model) {
    const pageElement = pageElementTotal[this.sample];

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
    let spotX = this.config[this.source][this.sample]["imageSpot"]["x"];
    let spotY = this.config[this.source][this.sample]["imageSpot"]["y"];
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
    const result = {
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
    return result;
  }
}

module.exports = async function ({ config, backend, dataType, model }) {
  const instance = new SegmentAnything(config);
  return await instance.execute(backend, dataType, model);
};

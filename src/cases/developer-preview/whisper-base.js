const util = require("../../utils/util.js");
const BaseSample = require("./base-sample.js");
const pageElementTotal = require("../../page-elements/developer-preview.js");
const path = require("path");

class WhisperBase extends BaseSample {
  constructor(config) {
    super(config, "whisper-base");
    this.recordMemory = true;
  }

  async run(page, backend, dataType, model) {
    const pageElement = pageElementTotal[this.sample];

    // wait for the source load finished (record button enabled)
    await Promise.race([
      util.waitForElementEnabled(page, pageElement["recordButton"]),
      util.throwOnUncaughtException(page)
    ]);

    // upload an audio
    const inputElement = await page.$(pageElement["uploadInput"]);
    const audioPath = path.join(
      path.resolve(__dirname),
      "../../../assets/audio",
      this.config[this.source][this.sample]["examples"][0].name
    );

    await inputElement.uploadFile(audioPath);
    // wait for the results show (record_button enabled)
    await Promise.race([
      util.waitForElementEnabled(page, pageElement["recordButton"]),
      util.throwOnUncaughtException(page)
    ]);

    // get results
    const outputText = await page.$eval(pageElement["outputText"], (el) => el.textContent);
    const expectedText = this.config[this.source][this.sample]["examples"][0].expectedValue;

    if (outputText !== expectedText) {
      throw Error(`Unexpected recognition result "${outputText}", expected "${expectedText}"`);
    }

    const latency = await page.$eval(pageElement["latency"], (el) => el.textContent);
    let xRealtime = parseFloat(latency.match(/([\d.]+)\s*x\s*realtime/)[1]);
    let timeToFirstToken = parseFloat(latency.match(/time to first token:\s*([\d.]+)ms/)[1]);
    let tokensPerSecond = parseFloat(latency.match(/([\d.]+)\s*tokens\/s/)[1]);

    console.log(`Test results- realtime:${xRealtime}, timeToFirstToken:${timeToFirstToken} `);

    return ["encoder", "decoder", "decoderKvCache"].reduce((acc, model) => {
      acc[model] = { tokensPerSecond };
      return acc;
    }, {});
  }
}

module.exports = async function ({ config, backend, dataType, model }) {
  const whisper = new WhisperBase(config);
  return await whisper.execute(backend, dataType, model);
};

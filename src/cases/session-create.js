const util = require("../utils/util.js");
const pageElement = require("../page-elements/samples");

module.exports = async function ({ config }) {
  const browser = await util.launchBrowser(config);
  try {
    const samplePage = (await browser.pages())[0];
    samplePage.setDefaultTimeout(config.timeout);
    await samplePage.goto("https://webmachinelearning.github.io/webnn-samples/lenet/", { waitUntil: "networkidle0" });
    await samplePage.waitForSelector(`::-p-xpath(${pageElement.backendText})`);
    await util.clickElementIfEnabled(samplePage, pageElement.gpu);
    await Promise.race([
      samplePage.waitForSelector(pageElement.handwrittenDigitsBuildTime, { visible: true }),
      util.throwErrorOnElement(samplePage, pageElement.alertWarning)
    ]);
    const gpuPage = await browser.newPage();
    await gpuPage.goto("chrome://gpu", { waitUntil: "networkidle0" });
    await gpuPage.waitForFunction(() => {
      const infoView = document.querySelector("info-view").shadowRoot;
      return infoView.querySelector("#content > div:last-child > h3 > span:nth-child(2)").innerText === "Log Messages";
    });
    const gpuLogMessages = await gpuPage.evaluate(() => {
      const infoView = document.querySelector("info-view").shadowRoot;
      return Array.from(infoView.querySelectorAll("#content > div:last-child > ul > li")).map((el) => el.innerText);
    });
    const webnnErrorMessages = gpuLogMessages
      .filter((message) => message.includes("[WebNN]"))
      .map((message) => message.split("[WebNN]", 2)[1]);
    if (webnnErrorMessages.length > 0) {
      throw new Error(webnnErrorMessages.join("\n"));
    }
  } finally {
    await browser.close();
  }
};

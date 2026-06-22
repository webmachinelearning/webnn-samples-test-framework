const { ensureDir, outDir } = require("./fs");
const { getTimestamp } = require("./common");

async function saveScreenshot(page, filename) {
  const timestamp = getTimestamp();
  const timestampMinute = getTimestamp(true);
  const screenshotDir = `${outDir}/${timestamp}/screenshots`;
  ensureDir(screenshotDir);
  // save page as image
  await page
    .screenshot({
      path: `${screenshotDir}/${filename}_${timestampMinute}.png`,
      type: "png"
    })
    .then(() => {
      console.log("Screenshot saved in " + screenshotDir);
    })
    .catch((error) => {
      console.error("Screenshot failed.", error);
    });
}

async function getAlertWarning(page, alertLocation) {
  try {
    return await page.$eval(alertLocation, (el) => el.textContent);
  } catch (error) {
    return "";
  }
}

async function throwErrorOnElement(page, element) {
  await page.waitForSelector(element, { visible: true });
  const error = await page.$eval(element, (el) => el.textContent);
  throw Error(error);
}

async function throwOnDevelopmentPreviewError(page, element) {
  await page.waitForFunction((selector) => {
    const text = document.querySelector(selector).textContent.trim();
    return text !== "WebNN" && text !== "WebNN supported";
  }, element);
  throw Error(await page.$eval(element, (el) => el.textContent));
}

async function throwOnUncaughtException(page) {
  return new Promise((resolve, reject) => {
    page.on("pageerror", reject);
  });
}

async function throwOnErrorLog(page) {
  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const lines = element.innerText.split("\n");
      for (const line of lines) {
        if (line.includes("[Error]")) {
          throw Error(line.split("[Error]")[1].trim());
        }
      }
      return false;
    },
    {},
    "#log"
  );
}

/**
 * Return a promise that rejects after the specified timeout.
 * Intended to be used with Promise.race() by the caller.
 * @param {number} ms - Timeout in milliseconds.
 * @param {string} [message] - Optional custom error message.
 * @returns {Promise<never>}
 */
function throwOnTimeout(ms, message) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message || `Operation timed out after ${ms}ms`)), ms);
  });
}

// wait for element enabled (disabled attribute disappear)
async function waitForElementEnabled(page, pageElement) {
  await page.waitForFunction((selector) => !document.querySelector(selector).hasAttribute("disabled"), {}, pageElement);
}

// click element if it is enabled, wait up to 3 seconds for enabled state
async function clickElementIfEnabled(page, selector) {
  try {
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.parentElement && !el.parentElement.classList.contains("disabled");
      },
      { timeout: 3000 },
      selector
    );
    await page.click(selector);
  } catch (error) {
    const title = await page.$eval(selector, (input) => input.parentElement.getAttribute("title"));
    const errorMessage = title
      ? `${selector} element is not clickable: ${title}`
      : `${selector} element is not clickable.`;
    throw new Error(errorMessage);
  }
}

module.exports = {
  saveScreenshot,
  getAlertWarning,
  throwErrorOnElement,
  throwOnDevelopmentPreviewError,
  throwOnUncaughtException,
  throwOnErrorLog,
  throwOnTimeout,
  waitForElementEnabled,
  clickElementIfEnabled
};

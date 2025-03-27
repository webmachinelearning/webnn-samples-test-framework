const fs = require("fs");
const os = require("os");
const { spawnSync, execSync } = require("child_process");
const si = require("systeminformation");
const dayjs = require("dayjs");
const path = require("path");
const config = require("../../config.json");
const puppeteer = require("puppeteer");
const { createCanvas, Image } = require("canvas");
const prettier = require("prettier");
const env = require("../../env.json");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

let deviceInfo = {};
let cliArgs = {};
let chromePath;
// test results directory
const outDir = replacePathString(path.join(path.resolve(__dirname), "../../out"));
ensureDir(outDir);

function ensureDir(relativePath) {
  const absolutePath = path.resolve(relativePath);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
}

// replace path string \ to /
function replacePathString(str) {
  return str.replace(/\\/g, "/");
}

function getBrowserArgs(backend = "") {
  const browserArgs = [...config["browserArgs"]];
  // push webnn arguments by default
  browserArgs.push(...config["browserArgsWebnn"]);
  if (backend === "npu") {
    browserArgs.push(...config["browserArgsNpu"]);
  }
  if (env.proxy.host) {
    browserArgs.push(`--proxy-server=${env.proxy.host}:${env.proxy.port}`);
  }
  return browserArgs;
}

function getBrowserPath(browser) {
  let browserPath;
  let browserExeName;
  let userDataDir;

  switch (browser) {
    case "chrome_canary":
      chromePath = "Chrome SxS";
      if (deviceInfo.platform === "win32") {
        browserExeName = "chrome.exe";
        browserPath = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/${browserExeName}`;
        userDataDir = `${process.env.LOCALAPPDATA}/Google/${chromePath}/User Data`;
      }
      if (deviceInfo.platform === "linux") {
        browserExeName = "google-chrome-canary";
        browserPath = `/usr/bin/${browserExeName}`;
        userDataDir = `/home/${os.userInfo().username}/.config/${browserExeName}`;
      }
      if (deviceInfo.platform === "darwin") {
        browserExeName = "Google Chrome Canary";
        browserPath = `/Applications/${browserExeName}.app/Contents/MacOS/${browserExeName}`;
        userDataDir = `/Users/${os.userInfo().username}/Library/Application Support/Google/${chromePath}`;
      }
      break;

    case "chrome_dev":
      chromePath = "Chrome Dev";
      if (deviceInfo.platform === "win32") {
        browserExeName = "chrome.exe";
        browserPath = `${process.env.PROGRAMFILES}/Google/Chrome Dev/Application/${browserExeName}`;
        userDataDir = `${process.env.LOCALAPPDATA}/Google/${chromePath}/User Data`;
      }
      if (deviceInfo.platform === "linux") {
        browserExeName = "google-chrome-unstable";
        browserPath = `/usr/bin/${browserExeName}`;
        userDataDir = `/home/${os.userInfo().username}/.config/google-chrome-unstable`;
      }
      if (deviceInfo.platform === "darwin") {
        browserExeName = "Google Chrome Dev";
        browserPath = `/Applications/${browserExeName}.app/Contents/MacOS/${browserExeName}`;
        userDataDir = `/Users/${os.userInfo().username}/Library/Application Support/Google/${chromePath}`;
      }

      break;

    case "chrome_beta":
      chromePath = "Chrome Beta";
      if (deviceInfo.platform === "win32") {
        browserExeName = "chrome.exe";
        browserPath = `${process.env.PROGRAMFILES}/Google/Chrome Beta/Application/${browserExeName}`;
        userDataDir = `${process.env.LOCALAPPDATA}/Google/${chromePath}/User Data`;
      }
      if (deviceInfo.platform === "linux") {
        browserExeName = "google-chrome-beta";
        browserPath = `/usr/bin/${browserExeName}`;
        userDataDir = `/home/${os.userInfo().username}/.config/${browserExeName}`;
      }
      if (deviceInfo.platform === "darwin") {
        browserExeName = "Google Chrome Beta";
        browserPath = `/Applications/${browserExeName}.app/Contents/MacOS/${browserExeName}`;
        userDataDir = `/Users/${os.userInfo().username}/Library/Application Support/Google/${chromePath}`;
      }
      break;

    case "chrome_stable":
      chromePath = "Chrome";
      if (deviceInfo.platform === "win32") {
        browserExeName = "chrome.exe";
        browserPath = `${process.env.PROGRAMFILES}/Google/Chrome/Application/${browserExeName}`;
        userDataDir = `${process.env.LOCALAPPDATA}/Google/${chromePath}/User Data`;
      }
      if (deviceInfo.platform === "linux") {
        browserExeName = "google-chrome-stable";
        browserPath = `/usr/bin/${browserExeName}`;
        userDataDir = `/home/${os.userInfo().username}/.config/${browserExeName}`;
      }
      if (deviceInfo.platform === "darwin") {
        browserExeName = "Google Chrome";
        browserPath = `/Applications/${browserExeName}.app/Contents/MacOS/${browserExeName}`;
        userDataDir = `/Users/${os.userInfo().username}/Library/Application Support/Google/${chromePath}`;
      }

      break;

    case "edge_canary":
      if (deviceInfo.platform === "win32") {
        browserExeName = "msedge.exe";
        browserPath = `${process.env.LOCALAPPDATA}/Microsoft/Edge SxS/Application/${browserExeName}`;
        userDataDir = `${process.env.LOCALAPPDATA}/Microsoft/Edge SxS/User Data`;
      }

      if (deviceInfo.platform === "linux") {
        browserExeName = "microsoft-edge-dev";
        browserPath = `/usr/bin/${browserExeName}`;
        userDataDir = `/home/${os.userInfo().username}/.config/${browserExeName}`;
      }

      if (deviceInfo.platform === "darwin") {
        browserExeName = "Microsoft Edge Canary";
        browserPath = `/Applications/${browserExeName}.app/Contents/MacOS/${browserExeName}`;
        userDataDir = `/Users/${os.userInfo().username}/Library/Application Support/${browserExeName}`;
      }
      break;

    default:
      browserPath = config.browser || "";
  }

  if (config.browserAppPath) {
    browserPath = `${config.browserAppPath}\\${browserExeName}`;
  }

  if (config.browserUserData && config.browserUserDataPath) {
    userDataDir = config.browserUserDataPath;
  }

  return { browserPath, userDataDir };
}

async function saveJsonFile(data) {
  const jsonData = JSON.stringify(data);
  const formattedJsonData = await prettier.format(jsonData, { parser: "json" });
  const timestamp = getTimestamp();
  const fileName = env.env === "production" ? getTimestamp() : getTimestamp(true);
  const directoryPath = `${outDir}/${timestamp}`;
  ensureDir(directoryPath);
  const filePath = `${directoryPath}/${fileName}.json`;
  try {
    fs.writeFileSync(filePath, formattedJsonData, "utf8");
    console.log("json file has been saved in " + filePath);
  } catch (error) {
    console.log("json file save failed", error);
  }
  return filePath;
}

function copyFile(source, target, { targetName } = {}) {
  const targetPath = path.join(target, targetName || path.basename(source));
  ensureDir(target);

  try {
    fs.copyFileSync(source, targetPath);
    console.log(`File copied to ${targetPath}`);
  } catch (error) {
    console.error(`Error copying file: ${error}`);
  }
}

function getTimestamp(minute = false) {
  const timestamp = Date.now();
  let formattedTimestamp;
  if (minute === true) {
    formattedTimestamp = dayjs(timestamp).format("YYYYMMDDHHmm");
  } else {
    formattedTimestamp = dayjs(timestamp).format("YYYYMMDD");
  }
  return formattedTimestamp;
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

function formatTimeResult(str) {
  return str.replace("ms", "").trim();
}

function replaceEmptyData(data) {
  for (let key in data) {
    if (data[key] === "" && key !== "error") {
      data[key] = "NA";
    }
  }
  return data;
}

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

async function saveCanvasImage(page, canvas_element, filename) {
  try {
    const canvas = await page.$(canvas_element);
    // get Canvas data URL
    const canvasDataURL = await page.evaluate((canvas) => {
      return canvas.toDataURL();
    }, canvas);

    //  transform URL to Buffer
    const base64Data = canvasDataURL.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // save image
    const timestamp = getTimestamp();
    const canvasDir = `${outDir}/${timestamp}/canvas_image`;
    ensureDir(canvasDir);
    fs.writeFileSync(`${canvasDir}/${filename}.png`, buffer);

    // console.log("canvas image has been saved in " + canvasDir);
    return { canvasPath: `${canvasDir}/${filename}.png` };
  } catch (error) {
    console.log("canvas image save fail", error);
  }
}

function compareImages(imagePath1, imagePath2) {
  function loadImageSync(imagePath) {
    const image = new Image();
    const buffer = fs.readFileSync(imagePath);
    image.src = buffer;
    return image;
  }

  const image1 = loadImageSync(imagePath1);
  const image2 = loadImageSync(imagePath2);

  if (image1.width !== image2.width || image1.height !== image2.height) {
    return 0; // Return 0% similarity if dimensions do not match
  }

  const canvas1 = createCanvas(image1.width, image1.height);
  const ctx1 = canvas1.getContext("2d");
  ctx1.drawImage(image1, 0, 0);
  const data1 = ctx1.getImageData(0, 0, image1.width, image1.height).data;

  const canvas2 = createCanvas(image2.width, image2.height);
  const ctx2 = canvas2.getContext("2d");
  ctx2.drawImage(image2, 0, 0);
  const data2 = ctx2.getImageData(0, 0, image2.width, image2.height).data;

  let totalDiff = 0;

  for (let i = 0; i < data1.length; i += 4) {
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
    const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);

    totalDiff += rDiff + gDiff + bDiff;
  }

  const maxDiff = (data1.length / 4) * 255 * 3;
  const similarity = ((maxDiff - totalDiff) / maxDiff) * 100;

  return similarity;
}

async function getAlertWarning(page, alertLocation) {
  try {
    return await page.$eval(alertLocation, (el) => el.textContent);
  } catch (error) {
    return "";
  }
}

// judge element classlist has "disabled" value
async function judgeElementClickable(page, pageElement, parent = false) {
  let isDisabled = false;
  // if parent element exists
  if (!parent) {
    isDisabled = await page.$eval(pageElement, (element) => element.classList.contains("disabled"));
  } else {
    isDisabled = await page.$eval(pageElement, (element) => element.parentElement.classList.contains("disabled"));
  }

  // click the element
  if (isDisabled) {
    return true;
  } else {
    await page.click(pageElement);
    return false;
  }
}

// wait for element enabled (disabled attribute disappear)
async function waitForElementEnabled(page, pageElement) {
  await page.waitForFunction((selector) => !document.querySelector(selector).hasAttribute("disabled"), {}, pageElement);
}

// get device info
async function getConfig() {
  deviceInfo["hostname"] = config["hostname"] ? config["hostname"] : os.hostname();
  deviceInfo.platform = os.platform();
  deviceInfo["samplesUrl"] = config["samplesBasicUrl"];
  deviceInfo["developerPreviewUrl"] = config["developerPreviewBasicUrl"];
  deviceInfo["browser"] = config["browser"];
  deviceInfo["browserArgs"] = config["browserArgs"];
  deviceInfo["browserArgsWebnn"] = config["browserArgsWebnn"];
  const { browserPath, userDataDir } = getBrowserPath(config["browser"]);
  deviceInfo["browserPath"] = browserPath;

  try {
    // Get Browser version
    let browser = await puppeteer.launch({
      headless: config.headless,
      defaultViewport: null,
      executablePath: browserPath,
      ignoreHTTPSErrors: true,
      protocolTimeout: config["timeout"],
      userDataDir: userDataDir
    });
    const page = await browser.newPage();

    // Edge version and Chromium version
    if (deviceInfo["browser"].match("edge_")) {
      await page.goto("edge://version");
      deviceInfo["edgeVersion"] = await page.$eval("#copy-content", (el) => el.innerText);
      deviceInfo["chromiumVersion"] = await page.evaluate(() => {
        return document.querySelectorAll(".version")[2].innerText;
      });
    } else if (deviceInfo["browser"].match("chrome_")) {
      // Get Chrome version
      await page.goto("chrome://version");
      deviceInfo["chromeVersion"] = await page.$eval("#copy-content span:first-child", (el) => el.innerText);
    }

    await browser.close();
  } catch (error) {
    console.error(`Error occurred while getting browser info\n. Error Details: ${error}`);
  }

  // CPU
  const cpuData = await si.cpu();
  let cpuName = cpuData.brand;
  const cpuManufacturer = cpuData.manufacturer;
  if (cpuManufacturer.includes("Intel")) {
    cpuName = cpuName.split(" ").pop();
  } else if (cpuManufacturer.includes("AMD")) {
    cpuName = cpuName.split(" ").slice(0, 3).join(" ");
  }
  deviceInfo["cpuName"] = cpuName;

  // GPU
  try {
    if (deviceInfo.platform === "win32") {
      const info = execSync(
        `powershell -Command "Get-CimInstance -ClassName Win32_VideoController | Select-Object Name,DriverVersion,Status,PNPDeviceID | ConvertTo-Json"`
      )
        .toString()
        .trim();
      const gpuInfo = JSON.parse(info);
      if (gpuInfo.length > 1) {
        for (let i = 0; i < gpuInfo.length; i++) {
          let match;
          deviceInfo["gpuName"] = gpuInfo[i]["Name"];
          if (deviceInfo["gpuName"].match("Microsoft")) {
            continue;
          }
          deviceInfo["gpuDriverVersion"] = gpuInfo[i]["DriverVersion"];

          match = gpuInfo[i]["PNPDeviceID"].match(".*DEV_(.{4})");
          deviceInfo["gpuDeviceId"] = match[1].toUpperCase();

          match = gpuInfo[i]["PNPDeviceID"].match(".*VEN_(.{4})");
          deviceInfo["gpuVendorId"] = match[1].toUpperCase();

          match = gpuInfo[i]["Status"];
          if (match) {
            if (match == "OK") {
              break;
            }
          }
        }
      } else {
        let match;
        deviceInfo["gpuName"] = gpuInfo["Name"];
        deviceInfo["gpuDriverVersion"] = gpuInfo["DriverVersion"];

        match = gpuInfo["PNPDeviceID"].match(".*DEV_(.{4})");
        deviceInfo["gpuDeviceId"] = match[1].toUpperCase();

        match = gpuInfo["PNPDeviceID"].match(".*VEN_(.{4})");
        deviceInfo["gpuVendorId"] = match[1].toUpperCase();
      }
    } else if (deviceInfo.platform === "darwin") {
      // macOS command
      const info = execSync("system_profiler SPDisplaysDataType").toString().trim();

      const nameMatch = info.match(/Chipset Model:\s+(.*)/);
      const vendorMatch = info.match(/Vendor:\s+(.*)/);
      const driverMatch = info.match(/Metal Support:\s+(.*)/);

      deviceInfo["gpuName"] = nameMatch ? nameMatch[1].trim() : "";
      deviceInfo["gpuVendor"] = vendorMatch ? vendorMatch[1].trim() : "";
      deviceInfo["gpuDriverVersion"] = driverMatch ? driverMatch[1].trim() : "";
    } else if (deviceInfo.platform === "linux") {
      const info = execSync(`lshw -C display`).toString().trim();
      const productMatch = info.match(/product:\s+(.+)/i);
      const vendorMatch = info.match(/vendor:\s+(.+)/i);
      const driverMatch = info.match(/configuration:\s+driver=(\w+)\s/i);

      deviceInfo["gpuName"] = productMatch ? productMatch[1].trim() : "";
      deviceInfo["gpuVendor"] = vendorMatch ? vendorMatch[1].trim() : "";
      deviceInfo["gpuDriverVersion"] = driverMatch ? driverMatch[1].trim() : "";
    }
  } catch (error) {
    console.error(`Error occurred while getting GPU info\n. Error Details: ${error}`);
  }

  // NPU
  try {
    if (deviceInfo.platform === "win32") {
      const info = execSync(
        `powershell -Command "Get-CimInstance -ClassName Win32_PnPEntity | Where-Object { $_.Name -like '*NPU*' } | Select-Object Name,Manufacturer,DeviceID | ConvertTo-Json"`
      )
        .toString()
        .trim();
      const npuInfo = JSON.parse(info);
      for (let i = 0; i < npuInfo.length; i++) {
        if (npuInfo[i]["Name"].match("Microsoft")) {
          continue;
        }
        deviceInfo["npuName"] = npuInfo[i]["Name"];
        deviceInfo["npuManufacturer"] = npuInfo[i]["Manufacturer"];
        const match = npuInfo[i]["DeviceID"].match(".*DEV_(.{4})");
        deviceInfo["npuDeviceId"] = match ? match[1].toUpperCase() : "Unknown";
        const versionMatch = npuInfo[i]["Name"].match(/npu-driver-ci-master-(\d+)/);
        deviceInfo["npuDriverVersion"] = versionMatch ? versionMatch[1] : "Unknown";
        break;
      }
    }
  } catch (error) {
    console.error(`Error occurred while getting NPU info\n. Error Details: ${error}`);
  }
}

// click element if it is enabled
async function clickElementIfEnabled(page, selector) {
  // Retrieve element information such as disabled state and title
  const elementInfo = await page.$eval(selector, (input) => {
    const parentElement = input.parentElement;
    const isDisabled = parentElement.classList.contains("disabled");
    const title = parentElement.getAttribute("title");
    return { isDisabled, title };
  });

  // If the element is disabled, throw an error with the title or a default message
  if (elementInfo.isDisabled) {
    const errorMessage = elementInfo.title
      ? `${selector} element is not clickable: ${elementInfo.title}`
      : `${selector} element is not clickable.`;
    throw new Error(errorMessage);
  } else {
    // If it's not disabled, proceed with the click
    await page.click(selector);
  }
}

function killBrowserProcess() {
  const platform = os.platform();
  const browserProcess = getBrowserProcess();

  if (platform === "win32") {
    spawnSync("cmd", ["/c", `taskkill /F /IM ${browserProcess} /T`]);
  } else if (platform === "linux" || platform === "darwin") {
    spawnSync("pkill", ["-f", browserProcess]);
  }
}

function getBrowserProcess() {
  const platform = os.platform();
  const browser = config.browser;

  const browserMap = {
    chrome: {
      win32: "chrome.exe",
      linux: "chrome",
      darwin: "Google Chrome"
    },
    edge: {
      win32: "msedge.exe",
      linux: "microsoft-edge",
      darwin: "Microsoft Edge"
    }
  };

  for (const key in browserMap) {
    if (browser.startsWith(key)) {
      return browserMap[key][platform];
    }
  }
}

function generateSupportedSamplesArray() {
  const allSupportedSamples = [];
  const samples = config.samples;
  const developerPreview = config.developerPreview;

  function parseJSON(obj, currentPath, result = []) {
    for (const key in obj) {
      if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
        if (currentPath) parseJSON(obj[key], [...currentPath, key], result);
      } else if (Array.isArray(obj[key])) {
        // key equals dataType: fp32 | fp16 | _
        if (["fp32", "fp16", "_"].includes(key) && currentPath.length === 3) {
          obj[key].forEach((model) => {
            let fullPath = "";
            fullPath = [currentPath[0], currentPath[1], currentPath[2], key, model].join("-");
            if (fullPath) result.push(...(Array.isArray(fullPath) ? fullPath : [fullPath]));
          });
        }
      } else {
        continue;
      }
    }
    return result;
  }

  allSupportedSamples.push(...parseJSON(samples, ["samples"]));
  allSupportedSamples.push(...parseJSON(developerPreview, ["developerPreview"]));
  return allSupportedSamples;
}

/**
 * @input array string
 * @returns calculation average results in string with 2 decimal places
 * */
function calculateAverage(arr) {
  const numericArray = arr.map(parseFloat).filter((value) => !isNaN(value));
  const sum = numericArray.reduce((acc, val) => acc + val, 0);
  const average = numericArray.length > 0 ? sum / numericArray.length : 0;
  return Number(average.toFixed(2)).toString();
}

function getMedianValue(arr) {
  const sorted = arr.map(Number).sort((a, b) => a - b);

  const mid = Math.floor(sorted.length / 2);
  const result = sorted.length === 0 ? 0 : sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return result.toFixed(2).toString();
}

function getBestValue(arr) {
  const numericArray = arr.map(parseFloat).filter((value) => !isNaN(value));
  const bestValue = numericArray.length > 0 ? Math.min(...numericArray) : 0;
  return bestValue.toString();
}

// parse the parameter args in cli commands and set the value into the config
function parseTestCliArgs(processArgv) {
  const helpMessage = `
##### WebNN Samples Test #####

Usage:
  npm test -- [options]

Options:
  -h, --help                    Print this message
  -f=, --filter=                Specify the specific single sample test
  --browserAppPath=             Specify browser 'Application' folder path (relative | absolute)
                                Relative path should be based on sample test root
  --browserUserDataPath=        Specify browser 'User Data' folder path (relative | absolute)
                                Relative path should be based on sample test root
      `;

  // distinguish the `--help` option because it is the default handling value in yargs
  if (processArgv.length === 3 && processArgv[2] === "--help") {
    console.log(helpMessage);
    console.log(">>> All supported samples are as followings, select one from them.");
    console.table(generateSupportedSamplesArray());
    process.exit();
  }

  const args = yargs(hideBin(processArgv)).parse();

  // "_", "$0" are default element after `yargs` parse.
  const validArgs = ["h", "help", "f", "filter", "browserAppPath", "browserUserDataPath", "_", "$0"];
  const invalidArgs = Object.keys(args).filter((arg) => !validArgs.includes(arg));

  if (invalidArgs.length > 0) {
    console.log(`Invalid arguments: ${invalidArgs.join(", ")}`);
    process.exit(1);
  }

  if (args.h) {
    console.log(helpMessage);
    console.log(">>> All supported samples are as followings, select one from them.");
    console.table(generateSupportedSamplesArray());
    process.exit();
  }

  if (args.filter || args.f || args.filter === "" || args.filter === "") {
    const filter = args.filter || args.f;
    const allSupportedSamples = generateSupportedSamplesArray();
    if (!allSupportedSamples.includes(filter)) {
      console.log(">>> The sample filter provided is invalid, all supported samples are as followings");
      console.table(generateSupportedSamplesArray());
      process.exit();
    }
  }

  if (args.hasOwnProperty("browserAppPath") && args.browserAppPath === "") {
    console.log("Invalid browserAppPath. Please specify the valid one.");
    process.exit();
  }
  if (args.hasOwnProperty("browserUserDataPath") && args.browserUserDataPath === "") {
    console.log("Invalid browserUserDataPath path. Please specify the valid one.");
    process.exit();
  }

  // Strip quotes from paths if present
  const cleanPath = (str) => (str ? str.replace(/^['"]|['"]$/g, "") : str);

  let browserAppPath = cleanPath(args.browserAppPath);
  let browserUserDataPath = cleanPath(args.browserUserDataPath);

  cliArgs.filter = args.filter || args.f;

  // Check if overrides are needed and update config
  const updates = {};

  if (browserAppPath) {
    // save the original value into cliArgs object
    cliArgs.browserAppPath = browserAppPath;
    // convert into absolute path
    browserAppPath = path.isAbsolute(browserAppPath) ? browserAppPath : path.resolve(__dirname, "..", browserAppPath);
    if (config.browserAppPath !== browserAppPath) {
      updates.browserAppPath = browserAppPath;
    }
  }

  if (browserUserDataPath) {
    // save the original value into cliArgs object
    cliArgs.browserUserDataPath = browserUserDataPath;
    // convert into absolute path
    browserUserDataPath = path.isAbsolute(browserUserDataPath)
      ? browserUserDataPath
      : path.resolve(__dirname, "..", browserUserDataPath);
    if (config.browserUserDataPath !== browserUserDataPath) {
      updates.browserUserDataPath = browserUserDataPath;
    }
  }

  // If any updates were made, update config and write back to file
  if (Object.keys(updates).length > 0) {
    Object.assign(config, updates);
    fs.writeFileSync(path.join(__dirname, "..", "..", "config.json"), JSON.stringify(config, null, 2), "utf-8");
  }
}

module.exports = {
  getBrowserArgs,
  getBrowserPath,
  getTimestamp,
  saveJsonFile,
  delay,
  formatTimeResult,
  replaceEmptyData,
  saveScreenshot,
  getAlertWarning,
  getConfig,
  saveCanvasImage,
  compareImages,
  judgeElementClickable,
  waitForElementEnabled,
  killBrowserProcess,
  getBrowserProcess,
  chromePath,
  deviceInfo,
  clickElementIfEnabled,
  generateSupportedSamplesArray,
  calculateAverage,
  getMedianValue,
  getBestValue,
  parseTestCliArgs,
  cliArgs,
  copyFile
};

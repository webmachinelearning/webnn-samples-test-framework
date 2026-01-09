const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");
const { spawnSync } = require("child_process");
const { env } = require("./env");

function getBrowserArgs(config) {
  // puppeteer will manipulate the args, so we create a copy
  const browserArgs = [...config["browserArgs"]];
  if (env.proxy.host) {
    browserArgs.push(`--proxy-server=${env.proxy.host}:${env.proxy.port}`);
  }
  return browserArgs;
}

function getBrowserPath(config) {
  const browser = config.browser;
  let userDataDir;
  if (config.browserUserData && config.browserUserDataPath) {
    userDataDir = config.browserUserDataPath;
  } else {
    userDataDir = path.join(os.tmpdir(), `webnn-sample-test-${browser}`);
  }

  const browserConfig = {
    chrome_canary: { win32: "Chrome SxS", linux: "google-chrome-canary", darwin: "Google Chrome Canary" },
    chrome_dev: { win32: "Chrome Dev", linux: "google-chrome-unstable", darwin: "Google Chrome Dev" },
    chrome_beta: { win32: "Chrome Beta", linux: "google-chrome-beta", darwin: "Google Chrome Beta" },
    chrome_stable: { win32: "Chrome", linux: "google-chrome-stable", darwin: "Google Chrome" },
    edge_canary: { win32: "Edge SxS", /* not available on linux */ darwin: "Microsoft Edge Canary" },
    edge_dev: { win32: "Edge Dev", linux: "microsoft-edge-dev", darwin: "Microsoft Edge Dev" },
    edge_stable: { win32: "Edge", linux: "microsoft-edge-stable", darwin: "Microsoft Edge" },
    edge_beta: { win32: "Edge Beta", linux: "microsoft-edge-beta", darwin: "Microsoft Edge Beta" }
  };

  let browserPath;
  let browserExeName;
  const browserConf = browserConfig[browser];
  if (!browserConf) {
    throw new Error(`Unsupported browser: ${browser}`);
  }
  const browserName = browserConf[process.platform];
  if (!browserName) {
    throw new Error(`Unsupported browser for platform ${process.platform}: ${browser}`);
  }
  if (process.platform === "win32") {
    let baseDir;
    if (browser.includes("edge") && !browser.includes("canary")) {
      baseDir = process.env["ProgramFiles(x86)"];
    } else if (browser.includes("canary")) {
      baseDir = process.env.LOCALAPPDATA;
    } else {
      baseDir = process.env.PROGRAMFILES;
    }
    browserExeName = browser.includes("chrome") ? "chrome.exe" : "msedge.exe";
    browserPath = path.join(
      baseDir,
      browser.includes("edge") ? "Microsoft" : "Google",
      browserName,
      "Application",
      browserExeName
    );
  } else if (process.platform === "linux") {
    browserExeName = browserName;
    browserPath = path.join("/usr/bin", browserExeName);
  } else if (process.platform === "darwin") {
    browserExeName = browserName;
    browserPath = path.join("/Applications", `${browserName}.app`, "Contents", "MacOS", browserName);
  }

  if (config.browserAppPath) {
    browserPath = path.join(config.browserAppPath, browserExeName);
  }

  return { browserPath, userDataDir };
}

async function launchBrowser(config) {
  const { browserPath, userDataDir } = getBrowserPath(config);
  return await puppeteer.launch({
    headless: config.headless,
    defaultViewport: null,
    args: getBrowserArgs(config),
    executablePath: browserPath,
    ignoreHTTPSErrors: true,
    protocolTimeout: config.timeout,
    userDataDir
  });
}

function killBrowserProcess(config) {
  const platform = os.platform();
  const browserProcess = getBrowserProcess(config);

  if (platform === "win32") {
    spawnSync("cmd", ["/c", `taskkill /F /IM ${browserProcess} /T`]);
  } else if (platform === "linux" || platform === "darwin") {
    spawnSync("pkill", ["-f", browserProcess]);
  }
}

function getBrowserProcess(config) {
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

module.exports = {
  getBrowserPath,
  launchBrowser,
  killBrowserProcess,
  getBrowserProcess
};

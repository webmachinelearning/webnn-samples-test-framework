const os = require("os");
const { execSync } = require("child_process");
const puppeteer = require("puppeteer");
const { getBrowserPath } = require("./browser");

// get device info
async function getNPUInfo() {
  if (process.platform === "win32") {
    // Currently supports fetching Intel NPU (AI Boost) device information on Windows platforms,
    // other NPU manufacturers support will be added in the future.
    const command = `
        Get-WmiObject Win32_PnPSignedDriver |
        Where-Object { $_.DeviceName -match 'Intel\\(R\\) (AI Boost|NPU)' } |
        Select-Object DeviceName, DriverVersion, Manufacturer |
        ConvertTo-Json -Depth 3`;
    const info = execSync(`powershell -Command "${command.replace(/\n+/g, " ")}"`)
      .toString()
      .trim();
    if (info) {
      const npuInfo = JSON.parse(info);
      return {
        npuName: npuInfo["DeviceName"],
        npuManufacturer: npuInfo["Manufacturer"],
        npuDriverVersion: npuInfo["DriverVersion"]
      };
    }
  }
}

async function getDeviceInfo(config) {
  let deviceInfo = {
    hostname: config.hostname || os.hostname(),
    platform: os.platform(),
    samplesUrl: config.samplesBasicUrl,
    developerPreviewUrl: config.developerPreviewBasicUrl,
    backend: config.backend,
    browser: config.browser,
    browserArgs: config.browserArgs
  };
  const { browserPath, userDataDir } = getBrowserPath(config);
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
    const page = (await browser.pages())[0];

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
  if (process.platform === "win32") {
    const computerInfo = JSON.parse(execSync(`Get-ComputerInfo | ConvertTo-Json`, { shell: "powershell" }).toString());
    deviceInfo.cpuName = computerInfo.CsProcessors[0].Name;
    deviceInfo.installedMemoryGb = computerInfo.CsPhyicallyInstalledMemory / 1024 ** 2;
  } else {
    const si = require("systeminformation");
    const cpuData = await si.cpu();
    deviceInfo.cpuName = cpuData.brand;
    deviceInfo.totalMemoryGb = ((await si.mem()).total / 1024 ** 3).toFixed(1);
  }

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
            if (match === "OK") {
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
    deviceInfo = { ...deviceInfo, ...(await getNPUInfo()) };
  } catch (error) {
    console.error(`Error occurred while getting NPU info\n. Error Details: ${error}`);
  }

  return deviceInfo;
}

module.exports = {
  getNPUInfo,
  getDeviceInfo
};

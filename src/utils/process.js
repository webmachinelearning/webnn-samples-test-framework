const childProcess = require("child_process");
const os = require("os");

function getTotalMemory() {
  if (os.platform() === "linux") {
    let result = childProcess.execSync("free -m | grep Mem:");
    let totalMemory = result.toString().split(/\s+/)[1];
    return Number(totalMemory) * 1024 * 1024;
  } else if (os.platform() === "darwin") {
    let result = childProcess.execSync("sysctl -n hw.memsize");
    return Number(result);
  }
  return null;
}

function processInfo(id) {
  if (isNaN(id)) {
    return { error: "Given id is not a number" };
  }
  if (os.platform() === "win32") {
    let result = childProcess.execSync(`Get-Process -Id ${id} | Format-List *`, {
      shell: "powershell"
    });
    return result
      .toString()
      .split("\r\n")
      .filter((line) => line.includes(":"))
      .map((line) => {
        let tokens = line.split(":");
        let key = tokens[0].trim();
        let value = tokens.slice(1).join(":").trim();
        if (!isNaN(value)) {
          value = +value;
        }
        return { [key]: value };
      })
      .reduce((acc, obj) => {
        return Object.assign(acc, obj);
      });
  } else if (os.platform() === "linux") {
    const statusPath = `/proc/${id}/status`;
    if (!fs.existsSync(statusPath)) {
      return { error: "Process not found" };
    }
    const statusData = fs.readFileSync(statusPath, "utf8").split("\n");
    let info = {};
    statusData.forEach((line) => {
      if (line.includes(":")) {
        let [key, value] = line.split(":");
        key = key.trim();
        value = value.trim();
        if (key === "VmRSS") {
          info["VmRSSKb"] = parseInt(value, 10);
        } else if (key === "VmHWM") {
          info["VmHWMKb"] = parseInt(value, 10);
        }
      }
    });
    return info;
  } else if (os.platform() === "darwin") {
    const totalMemory = getTotalMemory();

    let result = childProcess.execSync(`ps -p ${id} -o pid,ppid,pcpu,pmem,etime,comm`, {
      shell: "/bin/bash"
    });
    let lines = result.toString().split("\n");
    if (lines.length < 2) {
      return { error: "Process not found" };
    }
    let headers = lines[0].trim().split(/\s+/);
    let values = lines[1].trim().split(/\s+/);
    let info = {};
    headers.forEach((header, index) => {
      if (header === "%MEM" && !isNaN(values[index])) {
        info["memoryConsumption"] = Math.floor((parseFloat(values[index]) / 100) * totalMemory);
      } else {
        info[header] = isNaN(values[index]) ? values[index] : +values[index];
      }
    });
    return info;
  } else {
    return { error: "Not implemented" };
  }
}

function getRendererProcessInfo(browserProcess) {
  if (os.platform() === "win32") {
    let stdout = childProcess.execSync(
      `Get-WmiObject -Class Win32_Process -Filter "Name='${browserProcess}'" | Select-Object ProcessId,CommandLine`,
      { shell: "powershell" }
    );
    let rendererProcesses = stdout
      .toString()
      .split("\r\n")
      .filter((line) => {
        return line.includes("--type=renderer") && !line.includes("--extension-process");
      })
      .map((line) => {
        return +line.trim().split(" ").slice(0)[0];
      });
    if (rendererProcesses.length === 0) {
      return { error: `${browserProcess} is not running` };
    }
    return rendererProcesses.map(processInfo).reduce((acc, obj) => {
      return acc.WorkingSet64 > obj.WorkingSet64 ? acc : obj;
    });
  } else if (os.platform() === "linux" || os.platform() === "darwin") {
    let stdout = childProcess.execSync(
      `ps -e -o pid,command | grep '${browserProcess}' | grep -- '--type=renderer' | grep -v -- '--extension-process'`,
      { shell: "/bin/bash" }
    );
    let rendererProcesses = stdout
      .toString()
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        return +line.trim().split(/\s+/)[0];
      });
    if (rendererProcesses.length === 0) {
      return { error: `${browserProcess} is not running` };
    }
    return rendererProcesses.map(processInfo).reduce((acc, obj) => {
      return acc["memoryConsumption"] > obj["memoryConsumption"] ? acc : obj;
    });
  } else {
    return { error: "Not implemented" };
  }
}

function getGpuProcessInfo(browserProcess) {
  if (os.platform() === "win32") {
    let stdout = childProcess.execSync(
      `Get-WmiObject -Class Win32_Process -Filter "Name='${browserProcess}'" | Select-Object ProcessId,CommandLine`,
      { shell: "powershell" }
    );
    let gpuProcess = stdout
      .toString()
      .split("\r\n")
      .filter((line) => {
        return line.includes("--type=gpu-process");
      })
      .map((line) => {
        return +line.trim().split(" ").slice(0)[0];
      });
    if (gpuProcess.length === 0) {
      return { error: `${browserProcess} is not running` };
    } else if (gpuProcess.length > 1) {
      return { error: "More than one browserProcess is running" };
    }
    return processInfo(gpuProcess[0]);
  } else if (os.platform() === "linux" || os.platform() === "darwin") {
    let stdout = childProcess.execSync(
      `ps -e -o pid,command | grep '${browserProcess}' | grep -- '--type=gpu-process' | grep -v -- '--extension-process'`,
      { shell: "/bin/bash" }
    );
    let gpuProcess = stdout
      .toString()
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        return +line.trim().split(/\s+/)[0];
      });
    if (gpuProcess.length === 0) {
      return { error: `${browserProcess} is not running` };
    } else if (gpuProcess.length > 1) {
      return { error: "More than one browserProcess is running" };
    }
    return processInfo(gpuProcess[0]);
  } else {
    return { error: "Not implemented" };
  }
}

module.exports = {
  processInfo,
  getRendererProcessInfo,
  getGpuProcessInfo
};

const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const nodemailer = require("nodemailer");
const util = require("./util.js");
const env = require("../../env.json");
const path = require("path");
const config = require("../../config.json");

function formatResultsAsHTMLTable(data) {
  const failuresSamples = [];
  const deviceInfo = [];
  const resultObj = {
    html: {
      total: 0,
      failed: 0,
      deviceInfoTable: "",
      performanceDataTable: "",
      memoryDataTable: "",
      failuresTable: ""
    },
    md: {
      total: 0,
      failed: 0,
      deviceInfoMdTable: "",
      performanceDataMdTable: "",
      memoryDataMdTable: "",
      failuresMdTable: "",
      testSummaryMdTable: ""
    }
  };
  const metrics = [
    "inferenceTime",
    "processTime",
    "first",
    "average",
    "median",
    "best",
    "tokensPerSecond",
    "throughput"
  ];

  const memoryMetrics = [
    "privateMemoryRendererBefore",
    "privateMemoryRendererAfter",
    "privateMemoryRendererPeak",
    "privateMemoryGpuBefore",
    "privateMemoryGpuAfter",
    "privateMemoryGpuPeak"
  ];

  const performanceData = {};
  const memoryConsumptionData = {};
  const testSummaryResults = [];

  let totalCaseCount = 0;

  function traverse(obj, path = "") {
    if (obj && typeof obj === "object") {
      for (const key in obj) {
        const currentPath = path ? `${path}-${key}` : key;
        if (currentPath.startsWith("samples") || currentPath.startsWith("developerPreview")) {
          if (key === "error") {
            // make each sample case has error attribute account
            totalCaseCount++;
            const variable = currentPath.replace(/-error/g, "");
            // if error is not empty
            if (obj[key]) {
              failuresSamples.push({ variable, error: obj[key] });
              testSummaryResults.push({ variable, status: "fail" });
            } else {
              // initialize the samples that do not have performance results
              // code editor & notepad
              if (!performanceData[variable]) {
                performanceData[variable] = {};
              }
              testSummaryResults.push({ variable, status: "pass" });
            }
          }
          // collect performance data
          else if (metrics.includes(key) && !obj["error"]) {
            // remove useless attribute
            const variable = currentPath.replace(`-${key}`, "");
            if (!performanceData[variable]) {
              performanceData[variable] = {};
            }
            performanceData[variable][key] = obj[key];
          }
          // collect memory data
          else if (memoryMetrics.includes(key) && !obj["error"]) {
            // remove useless attribute
            const variable = currentPath.replace(`-${key}`, "");
            if (!memoryConsumptionData[variable]) {
              memoryConsumptionData[variable] = {};
            }
            memoryConsumptionData[variable][key] = obj[key];
          } else {
            traverse(obj[key], currentPath);
          }
        } else if (key !== "deviceInfo" && currentPath.includes("deviceInfo")) {
          if (obj[key]) {
            deviceInfo.push({ category: key, detail: obj[key] });
          }
        } else {
          traverse(obj[key], currentPath);
        }
      }
    }
  }

  traverse(data);

  const deviceInfoRows = deviceInfo
    .map(
      ({ category, detail }) =>
        `<tr><td style="border: 1px solid black;">${category}</td><td style="border: 1px solid black;">${detail}</td></tr>`
    )
    .join("");

  let performanceDataRows = "";
  for (const variable in performanceData) {
    const item = performanceData[variable];
    performanceDataRows += `<tr><td style="border: 1px solid black;">${variable}</td>`;
    metrics.forEach((metric) => {
      if (item[metric]) {
        performanceDataRows += `<td style="border: 1px solid black;">${item[metric].toString().replace(/,/g, " | ")}</td>`;
      } else {
        performanceDataRows += `<td style="border: 1px solid black; text-align:center">-</td>`;
      }
    });
    performanceDataRows += "</tr>";
  }

  let memoryDataRows = "";
  for (const variable in memoryConsumptionData) {
    const item = memoryConsumptionData[variable];
    memoryDataRows += `<tr><td style="border: 1px solid black;">${variable}</td>`;
    memoryMetrics.forEach((metric) => {
      if (item[metric]) {
        memoryDataRows += `<td style="border: 1px solid black;">${(item[metric] / 1024 ** 3).toFixed(3)} </td>`;
      } else {
        memoryDataRows += `<td style="border: 1px solid black; text-align:center">-</td>`;
      }
    });
    memoryDataRows += "</tr>";
  }

  const failureTableRows = failuresSamples
    .map(
      ({ variable, error }) =>
        `<tr><td style="border: 1px solid black;">${variable}</td><td style="border: 1px solid black;">${error}</td></tr>`
    )
    .join("");

  resultObj.html.deviceInfoTable =
    deviceInfo.length > 0
      ? `
        <table style="border-collapse: collapse; width: 100%; table-layout: fixed;">
          <thead>
            <tr>
              <th style="
                border: 1px solid black; 
                padding: 0 4px 0 4px;
                background-color:rgb(4,116,196);
                text-align: center; 
                vertical-align: middle; 
                color:white
              ">
                Category
              </th>
              <th style="
                border: 1px solid black; 
                padding: 0 4px 0 4px;
                background-color:rgb(4,116,196); 
                text-align: center; 
                vertical-align: middle; 
                color:white
              ">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            ${deviceInfoRows}
          </tbody>
        </table>
        `
      : null;

  resultObj.html.performanceDataTable =
    Object.keys(performanceData).length > 0
      ? `
        <table style="border-collapse: collapse; width: 100%; table-layout: fixed;">
          <thead>
            <tr>
              <th style="
                border: 1px solid black; 
                padding: 0 4px 0 4px;
                background-color:rgb(4,116,196);
                text-align: center; 
                vertical-align: middle; 
                color:white
              ">
                Sample Case
              </th>
            ${metrics
              .map(
                (metric) => `
              <th style="
                border: 1px solid black; 
                padding: 0 4px 0 4px;
                background-color:rgb(4,116,196);
                text-align: center; 
                vertical-align: middle; 
                color:white
              ">
              ${
                metric !== "tokensPerSecond" && metric !== "throughput" && !metric.startsWith("memory")
                  ? `${metric} (ms)`
                  : metric === "throughput"
                    ? `${metric} (FPS)`
                    : metric
              } 
              </th>`
              )
              .join("")}
            </tr>
          </thead>
          <tbody>
            ${performanceDataRows}
          </tbody>
        </table>
        `
      : null;

  resultObj.html.memoryDataTable =
    Object.keys(memoryConsumptionData).length > 0
      ? `
        <table style="border-collapse: collapse; width: 100%; table-layout: fixed;">
          <thead>
            <tr>
              <th style="
                border: 1px solid black; 
                padding: 0 4px 0 4px;
                background-color:rgb(4,116,196);
                text-align: center; 
                vertical-align: middle; 
                color:white
              ">
                Sample Case
              </th>
            ${memoryMetrics
              .map(
                (metric) => `
              <th style="
                border: 1px solid black; 
                padding: 0 4px 0 4px;
                background-color:rgb(4,116,196);
                text-align: center; 
                vertical-align: middle; 
                color:white
              ">
              ${metric} (GB)
              </th>`
              )
              .join("")}
            </tr>
          </thead>
          <tbody>
            ${memoryDataRows}
          </tbody>
        </table>
        `
      : null;

  resultObj.html.failuresTable =
    failuresSamples.length > 0
      ? `
        <table style="border-collapse: collapse; width: 100%; table-layout: fixed;">
          <thead>
            <tr>
              <th style="
                border: 1px solid black; 
                padding: 0 4px 0 4px;
                background-color:rgb(4,116,196); 
                text-align: center; 
                vertical-align: middle; 
                color:white
              ">
                Failed Cases
              </th>
              <th style="
                border: 1px solid black; 
                padding: 0 4px 0 4px;
                background-color:rgb(4,116,196); 
                text-align: center; 
                vertical-align: middle; 
                color:white
              ">
                Error Details
              </th>
            </tr>
          </thead>
          <tbody>
            ${failureTableRows}
          </tbody>
        </table>
        `
      : null;

  resultObj.html.total = totalCaseCount;
  resultObj.html.failed = failuresSamples.length;

  // Construct table for md
  const escapeMarkdown = (text) => text.replace(/([\\`*_\[\]()#+\-.!|])/g, "\\$1");

  const deviceInfoMdTableHeaders = ["Category", "Details"];
  const deviceInfoMdTableRows = deviceInfo.map(({ category, detail }) => [escapeMarkdown(category), detail]);

  resultObj.md.deviceInfoMdTable =
    deviceInfo.length > 0
      ? `
| ${deviceInfoMdTableHeaders.join(" | ")} |
| ${deviceInfoMdTableHeaders.map(() => "---").join(" | ")} |
${deviceInfoMdTableRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`.trim()
      : "";

  const performanceMdTableHeaders = ["Sample Case", ...metrics.map((metric) => `${metric} (ms)`)];
  const performanceMdTableRows = Object.entries(performanceData).map(([variable, item]) => {
    const row = [escapeMarkdown(variable)];
    metrics.forEach((metric) => {
      row.push(item[metric] ? escapeMarkdown(item[metric].toString().replace(/,/g, " | ")) : "-");
    });
    return row;
  });

  resultObj.md.performanceDataMdTable =
    Object.keys(performanceData).length > 0
      ? `
| ${performanceMdTableHeaders.join(" | ")} |
| ${performanceMdTableHeaders.map(() => "---").join(" | ")} |
${performanceMdTableRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`.trim()
      : "";

  const failuresMdTableHeaders = ["Failed Cases", "Error Details"];
  const failuresMdTableRows = failuresSamples.map(({ variable, error }) => [escapeMarkdown(variable), error]);

  resultObj.md.failuresMdTable =
    failuresSamples.length > 0
      ? `
| ${failuresMdTableHeaders.join(" | ")} |
| ${failuresMdTableHeaders.map(() => "---").join(" | ")} |
${failuresMdTableRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`.trim()
      : "";

  const memoryMdTableHeaders = ["Sample Case", ...memoryMetrics.map((metric) => `${metric} (GB)`)];

  const memoryMdTableRows = Object.entries(memoryConsumptionData).map(([variable, item]) => {
    const row = [escapeMarkdown(variable)];
    memoryMetrics.forEach((metric) => {
      row.push(item[metric] ? (item[metric] / 1024 ** 3).toFixed(3) : "-");
    });
    return row;
  });

  resultObj.md.memoryDataMdTable =
    Object.keys(memoryConsumptionData).length > 0
      ? `
| ${memoryMdTableHeaders.join(" | ")} |
| ${memoryMdTableHeaders.map(() => "---").join(" | ")} |
${memoryMdTableRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`.trim()
      : "";

  const testSummaryMdTableHeaders = ["Sample Case", "Status"];
  const testSummaryMdTableRows = testSummaryResults.map(({ variable, status }) => [
    escapeMarkdown(variable),
    status === "pass" ? "✅" : "❌"
  ]);

  resultObj.md.testSummaryMdTable =
    testSummaryResults.length > 0
      ? `
| ${testSummaryMdTableHeaders.join(" | ")} |
| ${testSummaryMdTableHeaders.map(() => "---").join(" | ")} |
${testSummaryMdTableRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`.trim()
      : "";

  resultObj.md.total = totalCaseCount;
  resultObj.md.failed = failuresSamples.length;

  return resultObj;
}

async function sendMail(subject, filePath) {
  let transporter = nodemailer.createTransport(env.emailService.serverConfig);

  try {
    const jsonFileExists = fs.existsSync(filePath);
    const jsonFile = jsonFileExists ? fs.readFileSync(filePath, "utf8") : null;

    let mailOptions = {
      from: env.emailService.from,
      to: env.emailService.to,
      subject: subject
    };

    let htmlContent = `
      <p><strong>Test completed, please check the details below:</strong></p>
    `;

    if (jsonFileExists) {
      mailOptions.attachments = [
        {
          filename: "test-results.json",
          content: jsonFile
        }
      ];

      const jsonData = JSON.parse(jsonFile);

      const { total, failed, performanceDataTable, deviceInfoTable, memoryDataTable, failuresTable } =
        formatResultsAsHTMLTable(jsonData).html;

      if (deviceInfoTable) {
        htmlContent += `<p><strong>Device Info</strong></p>
          ${deviceInfoTable}`;
      }

      if (performanceDataTable) {
        htmlContent += `<p><strong>Performance Metric</strong></p>
        ${performanceDataTable}`;
      }

      if (memoryDataTable) {
        htmlContent += `<p><strong>Memory Consumption</strong></p>
        ${memoryDataTable}`;
      }

      if (failuresTable) {
        htmlContent += `
          <p><strong>Test Summary (Failed / Total) : ${failed}/ ${total}  </strong></p>
          ${failuresTable}
        `;
      } else {
        htmlContent += `
        <p><strong> All ${total} sample tests success.</strong></p>`;
      }
    }

    htmlContent += `
      <p>See trends at: 
        <a href="http://webrtc33.sh.intel.com/WebNN/sample/trends.html" style="color: blue; text-decoration: underline;">
          WebNN Test Trends
        </a>
      </p>
      <p>Thanks,<br>WebNN Team</p>
    `;

    mailOptions.html = htmlContent;

    await transporter.verify();
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Failed to send email:", error);
  } finally {
    transporter.close();
  }
}

async function report(filePath) {
  if (!env.emailService.to.length) {
    console.log("No email recipient, skipping.");
    return;
  }
  const hostname = env.hostname || os.hostname();
  const reportTime = util.getTimestamp(true);
  let subject = `[Sample Test][${config.browser}] ${hostname} ${reportTime}`;

  try {
    await sendMail(subject, filePath);
    console.log(`Email was sent to ${env.emailService.to}!`);
  } catch (error) {
    console.error(`Failed to send email: ${error.toString()}`);
  }
}

async function scpUpload(file) {
  let target = path.posix.join(env.scp.target, env.hostname || os.hostname());
  let [host, dir] = target.split(":");
  try {
    childProcess.spawnSync("ssh", [host, "mkdir", "-p", dir]);
    childProcess.spawnSync("scp", [file, target]);
  } catch (error) {
    console.log(`error occur during scp result to server: ${error.toString()}`);
  }
}

function generateTestSummaryMd(filePath) {
  const jsonFileExists = fs.existsSync(filePath);
  const jsonFile = jsonFileExists ? fs.readFileSync(filePath, "utf8") : null;
  const jsonData = JSON.parse(jsonFile);
  const {
    total,
    failed,
    deviceInfoMdTable,
    performanceDataMdTable,
    memoryDataMdTable,
    failuresMdTable,
    testSummaryMdTable
  } = formatResultsAsHTMLTable(jsonData).md;

  const markdownContent = `
${
  testSummaryMdTable
    ? `#### Test Summary (Success / Total): ${total - failed} / ${total}
${testSummaryMdTable}

---
`
    : ``
}

${
  deviceInfoMdTable
    ? `#### Device Info
${deviceInfoMdTable}

---
`
    : ``
}

${
  performanceDataMdTable
    ? `#### Performance Metrics
${performanceDataMdTable}

---
`
    : ``
}

${
  memoryDataMdTable
    ? `#### Memory Consumption
${memoryDataMdTable}

---
`
    : ``
}

${
  failuresMdTable
    ? `#### Failures
${failuresMdTable}`
    : ``
}`;
  const outputPath = filePath.replace(path.extname(filePath), ".md");
  fs.writeFileSync(outputPath, markdownContent.trim());
}

module.exports = {
  report,
  scpUpload,
  generateTestSummaryMd
};

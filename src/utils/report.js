const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { Liquid } = require("liquidjs");
const nodemailer = require("nodemailer");

const env = require("../../env.json");
const config = require("../../config.json");
const util = require("./util.js");

async function renderResultsAsHTML(data) {
  const failuresSamples = [];

  const memoryMetrics = [
    "privateMemoryRendererBefore",
    "privateMemoryRendererAfter",
    "privateMemoryRendererPeak",
    "privateMemoryGpuBefore",
    "privateMemoryGpuAfter",
    "privateMemoryGpuPeak"
  ];

  const memoryConsumptionData = {};
  const testSummaryResults = [];
  let totalCaseCount = 0;

  function traverse(obj, path = [], result) {
    for (const key in obj) {
      if (key === "error") {
        // make each sample case has error attribute account
        totalCaseCount++;
        const variable = path.join("-");
        // if error is not empty
        if (obj[key]) {
          failuresSamples.push({ variable, error: obj[key] });
          testSummaryResults.push({ variable, status: "fail" });
        } else {
          // initialize the samples that do not have performance results
          // code editor & notepad
          if (!result[variable]) {
            result[variable] = {};
          }
          testSummaryResults.push({ variable, status: "pass" });
        }
      }
      // collect performance data
      else if (
        path.length > 2 &&
        path.length === (path[0] === "samples" && path[1].startsWith("switch") ? 6 : 5) &&
        !obj["error"]
      ) {
        // remove useless attribute
        const variable = path.join("-");
        if (!result[variable]) {
          result[variable] = {};
        }
        if (Array.isArray(obj[key])) {
          obj[key] = obj[key].join(", ");
        }
        result[variable][key] = obj[key];
      }
      // collect memory data
      else if (memoryMetrics.includes(key) && !obj["error"]) {
        // remove useless attribute
        const variable = path.slice(0, -1).join("-");
        if (!memoryConsumptionData[variable]) {
          memoryConsumptionData[variable] = {};
        }
        memoryConsumptionData[variable][key] = obj[key];
      } else {
        traverse(obj[key], [...path, key], result);
      }
    }
  }

  let samples = {};
  let developerPreview = {};
  traverse(data.samples, ["samples"], samples);
  traverse(data.developerPreview, ["developerPreview"], developerPreview);

  return new Liquid({
    root: path.resolve(__dirname, '../views'),
  }).renderFile("mail.liquid", {
    header: env.emailService.header,
    failed: failuresSamples.length,
    total: totalCaseCount,
    failedCases: failuresSamples,
    deviceInfo: data.deviceInfo,
    samples,
    developerPreview,
    memory: memoryConsumptionData,
    footer: env.emailService.footer,
    signature: env.emailService.signature ?? "WebNN Team",
  });
}

async function sendMail(subject, filePath) {
  let transporter = nodemailer.createTransport(env.emailService.serverConfig);
  try {
    const result = fs.readFileSync(filePath, "utf8");
    let mailOptions = {
      from: env.emailService.from,
      to: env.emailService.to,
      subject: subject,
      html: await renderResultsAsHTML(result),
      attachments: [
        {
          filename: "test-results.json",
          content: result
        }
      ]
    };
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

module.exports = {
  report,
  scpUpload,
  renderResultsAsHTML
};

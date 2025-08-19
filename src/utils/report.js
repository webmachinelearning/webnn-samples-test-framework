const childProcess = require("child_process");
const os = require("os");
const path = require("path");

const juice = require("juice");
const { Liquid } = require("liquidjs");
const nodemailer = require("nodemailer");

const env = require("../../env.json");
const util = require("./util.js");

async function renderResultsAsHTML(data) {
  const failuresSamples = [];
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
      else if (key.startsWith("privateMemory") && !obj["error"]) {
        const variable = path.join("-");
        if (!memoryConsumptionData[variable]) {
          memoryConsumptionData[variable] = {};
        }
        memoryConsumptionData[variable][key] = obj[key];
      } else {
        traverse(obj[key], [...path, key], result);
      }
    }
  }

  let result = {};
  traverse({ samples: data.samples, "developer-preview": data["developer-preview"] }, [], result);
  const inferenceTimeResult = Object.fromEntries(Object.entries(result).filter(([_, value]) => value.inferenceTime));
  const firstAverageMedianBestResult = Object.fromEntries(Object.entries(result).filter(([_, value]) => value.average));
  const tokenPerSecondResult = {};
  for (let [key, value] of Object.entries(result).filter(([_, value]) => value.tokensPerSecond)) {
    let prefix = key.split("-").slice(0, -1).join("-");
    let model = key.split("-").slice(-1)[0];
    if (!tokenPerSecondResult[prefix]) {
      tokenPerSecondResult[prefix] = { models: [model], tokensPerSecond: value.tokensPerSecond };
    } else if (tokenPerSecondResult[prefix].tokensPerSecond !== value.tokensPerSecond) {
      tokenPerSecondResult[key] = { models: [], tokensPerSecond: value.tokensPerSecond };
    } else {
      tokenPerSecondResult[prefix].models.push(model);
    }
  }
  let aggregatedFailures = {};
  for (let failure of failuresSamples) {
    let key = failure.variable.split("-").slice(0, -1).join("-");
    let model = failure.variable.split("-").slice(-1)[0];
    if (aggregatedFailures[key]?.error === failure.error) {
      aggregatedFailures[key].models.push(model);
    } else {
      aggregatedFailures[key] = {
        variable: key,
        models: [model],
        error: failure.error
      };
    }
  }

  const engine = new Liquid({
    root: path.resolve(__dirname, "../views")
  });
  engine.registerFilter("gb", (bytes) => {
    if (isNaN(bytes)) {
      return "-";
    }
    return (bytes / 1024 ** 3).toFixed(3);
  });
  return engine
    .renderFile("mail.liquid", {
      header: env.emailService.header,
      failed: failuresSamples.length,
      total: totalCaseCount,
      failedCases: Object.values(aggregatedFailures),
      deviceInfo: data.deviceInfo,
      inferenceTimeResult,
      firstAverageMedianBestResult,
      tokenPerSecondResult,
      memory: memoryConsumptionData,
      footer: env.emailService.footer,
      signature: env.emailService.signature ?? "WebNN Team"
    })
    .then(juice);
}

async function sendMail(subject, html, attachments) {
  let transporter = nodemailer.createTransport(env.emailService.serverConfig);
  try {
    await transporter.verify();
    await transporter.sendMail({
      from: env.emailService.from,
      to: env.emailService.to,
      subject,
      html,
      attachments
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  } finally {
    transporter.close();
  }
}

async function report(results) {
  if (!env.emailService.to.length) {
    console.log("No email recipient, skipping.");
    return;
  }
  const hostname = env.hostname || os.hostname();
  const reportTime = util.getTimestamp(true);
  let subject = `[Sample Test][${results.deviceInfo.browser}][${results.deviceInfo.backend}] ${hostname} ${reportTime}`;

  try {
    await sendMail(subject, await renderResultsAsHTML(results), [
      {
        filename: `webnn-samples-test-results-${hostname}-${reportTime}.json`,
        content: JSON.stringify(results, null, 2)
      }
    ]);
    console.log(`Sent email to ${env.emailService.to}!`);
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

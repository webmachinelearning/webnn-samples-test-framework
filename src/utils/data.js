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

function calculateAverage(arr) {
  const numericArray = arr.map(parseFloat).filter((value) => !isNaN(value));
  const sum = numericArray.reduce((acc, val) => acc + val, 0);
  const average = numericArray.length > 0 ? sum / numericArray.length : 0;
  return average.toFixed(2);
}

function getMedianValue(arr) {
  const sorted = arr.map(Number).sort((a, b) => a - b);

  const mid = Math.floor(sorted.length / 2);
  const result = sorted.length === 0 ? 0 : sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return result.toFixed(2);
}

function getBestValue(arr) {
  const numericArray = arr.map(parseFloat).filter((value) => !isNaN(value));
  const bestValue = numericArray.length > 0 ? Math.min(...numericArray) : 0;
  return bestValue.toFixed(2);
}

function generateSupportedSamplesArray(config) {
  const allSupportedSamples = [];

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

  allSupportedSamples.push(...parseJSON(config.samples, ["samples"]));
  allSupportedSamples.push(...parseJSON(config["developer-preview"], ["developer-preview"]));
  return allSupportedSamples;
}

module.exports = {
  formatTimeResult,
  replaceEmptyData,
  calculateAverage,
  getMedianValue,
  getBestValue,
  generateSupportedSamplesArray
};

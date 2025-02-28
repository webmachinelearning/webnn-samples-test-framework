const urlParams = new URLSearchParams(location.search);

async function fetchHosts() {
  const response = await fetch("data/");
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  const directories = Array.from(doc.querySelectorAll("a"))
    .map((a) => a.getAttribute("href"))
    .filter((href) => href.endsWith("/") && !href.includes(".."))
    .map((href) => href.slice(0, -1));

  return directories || [];
}

const availableHosts = await fetchHosts();
const host = urlParams.get("host") || availableHosts[0] || "";

const duration = Number(urlParams.get("duration")) || 14;
const changeType = urlParams.get("change-type") || "z-score";
const filterWhitelist = window.location.hash
  .slice(1)
  .split(",")
  .filter((key) => key !== "")
  .reduce((obj, key) => {
    obj[key] = true;
    return obj;
  }, {});

async function fetchHistoryData(host, period) {
  const dates = Array.from({ length: period }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split("T")[0].replace(/-/g, "");
  });
  let data = Object.fromEntries(dates.map((date) => [date, undefined]));
  (
    await Promise.allSettled(
      dates.map(async (date) => {
        let response = await fetch(`data/${host}/${date}.json`);
        return { ...(await response.json()), date };
      })
    )
  )
    .filter((result) => result.status === "fulfilled")
    .forEach((result) => {
      data[result.value.date] = result.value;
    });
  return data;
}

function queryData(data, key) {
  const keys = key.split("/");
  return Object.values(data).map((value) => value && keys.reduce((acc, k) => acc?.[k], value));
}

function getKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    if (typeof value === "object") {
      return getKeys(value, prefix + key + "/");
    } else {
      return prefix + key;
    }
  });
}

function filterDataKeys(keys, whiteList, blackList) {
  return keys
    .filter((key) => whiteList.some((f) => key.match(f.replace(/\*/g, ".*"))))
    .filter((key) => !blackList.some((f) => key.match(f.replace(/\*/g, ".*"))));
}

const whiteList = ["deviceInfo/*Version", "samples/*", "developerPreview/*"];
const blackList = ["error*", "deviceInfo/*Url"];
const alias = {
  "deviceInfo/chromeVersion": "Chrome version",
  "deviceInfo/chromiumVersion": "Chromium version",
  "deviceInfo/edgeVersion": "Edge version",
  "deviceInfo/gpuDriverVersion": "GPU driver version"
};
const filters = {
  samples: "samples/*",
  developerPreview: "developerPreview/*",
  cpu: "*/cpu/*",
  gpu: "*/gpu/*",
  fp32: "*/fp32/*",
  fp16: "*/fp16/*",
  inference: "*/inferenceTime|*/buildTime|*computeTime|*processTime|*first|*best|*average|*median",
  memory: "*/memory*",
  imageClassification: "imageClassification/*",
  fastStyleTransfer: "fastStyleTransfer/*",
  objectDetection: "objectDetection/*",
  semanticSegmentation: "semanticSegmentation/*",
  faceRecognition: "faceRecognition/*",
  facialLandmarkDetection: "facialLandmarkDetection/*",
  handwrittenDigitsClassification: "handwrittenDigitsClassification/*",
  noiseSuppression: "noiseSuppression*",
  switchSampleTest: "switchSampleTest/*",
  stableDiffusion15: "stableDiffusion15/*",
  stableDiffusionTurbo: "stableDiffusionTurbo/*",
  segmentAnything: "segmentAnything/*",
  whisperBase: "whisperBase/*"
};
const filterKeys = [
  ["samples", "developerPreview", "cpu", "gpu", "fp32", "fp16", "inference", "memory"],
  [
    "imageClassification",
    "fastStyleTransfer",
    "objectDetection",
    "semanticSegmentation",
    "faceRecognition",
    "facialLandmarkDetection",
    "handwrittenDigitsClassification",
    "noiseSuppression",
    "switchSampleTest"
  ],
  ["stableDiffusion15", "stableDiffusionTurbo", "segmentAnything", "whisperBase"]
];

Vue.createApp({
  data() {
    return {
      history: null,
      lastValid: null,
      deviceInfo: null,
      keys: null,
      dataKeys: null,
      wholeData: null,
      duration,
      host,
      changeType,
      filterKeys,
      filterWhitelist,
      availableHosts
    };
  },
  mounted() {
    this.fetchData();
  },
  computed: {
    data() {
      const filterWhitelist = Object.keys(this.filterWhitelist)
        .filter((key) => this.filterWhitelist[key])
        .map((key) => filters[key])
        .filter((key) => key !== undefined);
      let keys = filterDataKeys(this.dataKeys, whiteList, blackList);
      if (filterWhitelist.length > 0) {
        keys = filterDataKeys(keys, ["deviceInfo/*Version", ...filterWhitelist], []);
      }
      let filteredData = this.wholeData.filter((item) => new Set(keys).has(item.rawKey));
      let sameSinceRow = [0, 0];
      filteredData[0].span = [1, 1];
      filteredData[0].indent = 0;
      for (let i = 1; i < filteredData.length; i++) {
        filteredData[i].span = [1, 1];
        filteredData[i].indent = 0;
        if (
          filteredData[i].key[0] == filteredData[sameSinceRow[0]].key[0] &&
          filteredData[i].key[1] == filteredData[sameSinceRow[0]].key[1]
        ) {
          filteredData[i].indent = 1;
          filteredData[sameSinceRow[0]].span[0] = i - sameSinceRow[0] + 1;
          if (filteredData[i].key[2] == filteredData[sameSinceRow[1]].key[2]) {
            filteredData[i].indent = 2;
            filteredData[sameSinceRow[1]].span[1] = i - sameSinceRow[1] + 1;
          } else {
            sameSinceRow[1] = i;
          }
        } else {
          sameSinceRow = [i, i];
        }
      }
      return filteredData;
    }
  },
  methods: {
    async fetchData() {
      this.history = await fetchHistoryData(host, duration + 1);
      this.lastValid = Object.values(this.history)
        .filter((item) => item !== undefined)
        .slice(-1)[0];
      this.deviceInfo = this.lastValid?.deviceInfo;
      this.keys = Object.keys(this.history);
      this.dataKeys = getKeys(this.lastValid);
      this.wholeData = this.dataKeys.map((key) => {
        let item = {
          rawKey: key,
          key: key.split("/"),
          alias: alias[key] ?? undefined,
          type: key.includes("Version") ? "category" : key.includes("memory") ? "memory" : "number",
          data: queryData(this.history, key).map((item) => (String(item).endsWith("%") ? parseFloat(item) / 100 : item))
        };
        if (!isNaN(item.key[2])) {
          item.key.splice(2, 2);
        }
        item.values = item.data.filter((item) => typeof item !== "undefined");
        item.start = item.values[0];
        item.current = item.values.slice(-1)[0];
        let validData = item.values.slice(0, item.values.length - 1).filter((item) => item !== "" && item !== "NA");
        if (item.type === "category") {
          if (new Set(validData).size === 1) {
            item.average = validData[0];
          }
        } else if (validData.length > 1) {
          item.average = validData.reduce((x, y) => +x + +y) / validData.length;
          item.stdDev = Math.sqrt(
            validData.reduce((acc, value) => acc + Math.pow(value - item.average, 2), 0) / validData.length
          );
        }
        if (item.type === "category") {
          item.change = new Set(item.values).size - 1;
        } else {
          const baselineAverage = item.average ?? item.start;
          const relativeAverage = (item.current - baselineAverage) / baselineAverage;

          const baselineBefore = item.start;
          const relativeBefore = (item.current - baselineBefore) / baselineBefore;

          const zScore = item.stdDev === 0 ? 0 : (item.current - item.average) / item.stdDev;

          item.change = {
            average: {
              value: (relativeAverage * 100).toFixed(2) + "%",
              background:
                relativeAverage > 0
                  ? `rgba(255, 0, 0, ${relativeAverage * 10})`
                  : `rgba(0, 255, 0, ${-relativeAverage * 10})`
            },
            before: {
              value: (relativeBefore * 100).toFixed(2) + "%",
              background:
                relativeBefore > 0
                  ? `rgba(255, 0, 0, ${relativeBefore * 10})`
                  : `rgba(0, 255, 0, ${-relativeBefore * 10})`
            },
            "z-score": {
              value: zScore.toFixed(2),
              background: zScore > 0 ? `rgba(255, 0, 0, ${zScore / 4})` : `rgba(0, 255, 0, ${-zScore / 4})`
            }
          };
        }
        return item;
      });
    },
    onSelectChange(event) {
      urlParams.set("host", event.target.value);
      location.search = urlParams.toString();
    },
    onInputChange(event) {
      urlParams.set("duration", event.target.value);
      location.search = urlParams.toString();
    },
    onChangeTypeChange(event) {
      const changeTypes = ["z-score", "average", "before"];
      urlParams.set("change-type", changeTypes[(changeTypes.indexOf(this.changeType) + 1) % changeTypes.length]);
      location.search = urlParams.toString();
    },
    onFilterChange(event, key) {
      const checked = this.filterWhitelist[key];
      for (let k in this.filterWhitelist) {
        delete this.filterWhitelist[k];
      }
      if (!checked) {
        this.filterWhitelist[key] = true;
      }
      window.location.hash = Object.keys(this.filterWhitelist).join(",");
    },
    formatter(value, type) {
      if (isNaN(value)) {
        if (String(value).includes(",")) {
          return value.split(",")[0].trim() + ", ...";
        } else {
          return value;
        }
      } else {
        if (type === "memory") {
          const units = ["B", "KB", "MB", "GB"];
          let unitIndex = 0;
          while (value > 1000 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
          }
          return (unitIndex == 0 ? value : value.toPrecision(value < 1 ? 2 : 3)) + " " + units[unitIndex];
        } else if (value < 1) {
          return (+value).toPrecision(4);
        } else {
          return (+value).toFixed(2);
        }
      }
    },
    toEChartsOptions(item) {
      return {
        xAxis: { type: "category", data: this.keys },
        yAxis:
          item.type === "category"
            ? {
                type: "category",
                nameTruncate: { maxWidth: 13 }
              }
            : {
                type: "value",
                scale: true,
                splitNumber: 2,
                axisLabel: item.type === "memory" ? { formatter: (value) => this.formatter(value, "memory") } : {}
              },
        series: [{ type: "line", data: item.data, connectNulls: false }],
        grid: { left: 80, right: 0, top: 10, bottom: 5 },
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } }
      };
    }
  }
})
  .component("v-chart", VueECharts)
  .mount("#vue-root");

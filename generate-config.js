const fs = require("fs");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { getNPUInfo } = require("./src/utils/util");

function filterSamplesWithDevices(config, devices) {
  const result = JSON.parse(JSON.stringify(config));

  function filterDevice(obj, devices) {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    Object.keys(obj).forEach((key) => {
      if (key === "cpu" || key === "gpu" || key === "npu") {
        if (!devices.includes(key)) {
          delete obj[key];
        }
      } else if (typeof obj[key] === "object") {
        obj[key] = filterDevice(obj[key], devices);
      }
    });

    return obj;
  }

  function removeInvalidSamples(samples, devices) {
    Object.keys(samples).forEach((sampleName) => {
      // remove the `switchSampleTest` if devices do not include cpu & gpu
      // cause the sub samples are executed both on cpu and gpu
      const sample = samples[sampleName];
      if (sampleName === "switchSampleTest") {
        if (!devices.includes("cpu") || !devices.includes("gpu")) delete samples[sampleName];
      } else if (sampleName === "switchBackendTest") {
        // if the devices just include one, then the backend could not be switched
        const firstSample = sample.samples[Object.keys(sample.samples)[0]];
        if (devices.length < 2 || !devices.some((device) => firstSample[device])) {
          delete samples[sampleName];
        }
      } else if (!devices.some((device) => sample[device])) {
        delete samples[sampleName];
      }
    });
  }

  result.samples = filterDevice(result.samples, devices);
  result["developer-preview"] = filterDevice(result["developer-preview"], devices);

  removeInvalidSamples(result.samples, devices);
  removeInvalidSamples(result["developer-preview"], devices);

  return result;
}

// chrome_canary & cpu, npu, gpu by default
const ORIGINAL_CONFIG = {
  browser: "chrome_canary",
  browserArgs: ["--start-maximized"],
  browserArgsWebnn: ["--enable-features=WebMachineLearningNeuralNetwork,WebNNOnnxRuntime"],
  browserUserData: true,
  browserUserDataPath: "",
  browserAppPath: "",
  headless: false,
  timeout: 600000,
  errorMsgMaxLength: 200,
  imageCompareThreshold: 0.1,
  samplesBasicUrl: "https://webmachinelearning.github.io/webnn-samples",
  samplesUrl: {
    "face-recognition": "/face_recognition/",
    "facial-landmark-detection": "/facial_landmark_detection/",
    "fast-style-transfer": "/style_transfer/",
    "handwritten-digits-classification": "/lenet/",
    "image-classification": "/image_classification/?numRuns=50",
    "object-detection": "/object_detection/",
    "semantic-segmentation": "/semantic_segmentation/",
    "noise-suppression-nsnet2": "/nsnet2/",
    "noise-suppression-rnnoise": "/rnnoise/",
    "code-editor": "/code/",
    notepad: "/nnotepad/"
  },
  developerPreviewBasicUrl: "https://microsoft.github.io/webnn-developer-preview",
  developerPreviewUrl: {
    "stable-diffusion-1-5": "/demos/stable-diffusion-1.5/",
    "stable-diffusion-turbo": "/demos/sd-turbo/",
    "segment-anything": "/demos/segment-anything/",
    "whisper-base": "/demos/whisper-base/",
    "image-classification": "/demos/image-classification/"
  },
  samples: {
    "face-recognition": {
      cpu: {
        fp32: ["faceNetSsdMobileNetV2Face"]
      },
      gpu: {
        fp32: ["faceNetSsdMobileNetV2Face"]
      }
    },
    "facial-landmark-detection": {
      cpu: {
        fp32: ["simpleCnnSsdMobileNetV2Face"]
      },
      gpu: {
        fp32: ["simpleCnnSsdMobileNetV2Face"]
      }
    },
    "fast-style-transfer": {
      examples: ["starryNight"],
      cpu: {
        fp32: ["fastStyleTransfer"]
      },
      gpu: {
        fp32: ["fastStyleTransfer"]
      }
    },
    "handwritten-digits-classification": {
      rounds: 3,
      cpu: { fp32: ["leNet"] },
      gpu: { fp32: ["leNet"] }
    },
    "image-classification": {
      cpu: {
        fp32: ["mobileNetV2", "squeezeNet", "resNet50V2"]
      },
      gpu: {
        fp16: ["mobileNetV2", "resNet50V1", "efficientNet"],
        fp32: ["mobileNetV2", "squeezeNet", "resNet50V2"]
      },
      npu: {
        fp16: ["mobileNetV2", "resNet50V1", "efficientNet"]
      }
    },
    "object-detection": {
      cpu: {
        fp32: ["tinyYoloV2", "ssdMobileNetV1"]
      },
      gpu: {
        fp16: ["tinyYoloV2", "ssdMobileNetV1"],
        fp32: ["tinyYoloV2", "ssdMobileNetV1"]
      },
      npu: {
        fp16: ["ssdMobileNetV1"]
      }
    },
    "semantic-segmentation": {
      cpu: { fp32: ["deepLabV3MobileNetV2"] },
      gpu: { fp32: ["deepLabV3MobileNetV2"] }
    },
    "noise-suppression-nsnet2": {
      examples: ["babbleNoise", "carNoise", "streetNoise"],
      cpu: { fp32: ["nsNet2"] },
      gpu: { fp32: ["nsNet2"] }
    },
    "noise-suppression-rnnoise": {
      examples: ["backgroundNoise1", "backgroundNoise2", "backgroundNoise3"],
      cpu: { fp32: ["rnNoise"] },
      gpu: { fp32: ["rnNoise"] }
    },
    "code-editor": {
      gpu: { _: ["_"] },
      examples: [
        {
          name: "matmul.js",
          expectedValue:
            "values: 3.200000047683716,3.200000047683716,3.200000047683716,3.200000047683716,3.200000047683716,3.200000047683716,3.200000047683716,3.200000047683716,3.200000047683716"
        },
        { name: "mul_add.js", expectedValue: "Output value: 1,1,1,1" },
        { name: "simple_graph.js", expectedValue: "Output value: 2.25,2.25,2.25,2.25,2.25,2.25,2.25,2.25" }
      ]
    },
    notepad: {
      cpu: { _: ["_"] },
      gpu: { _: ["_"] },
      npu: { _: ["_"] },
      expectedValue:
        "dataType: float32<br>shape: [2]<br>tensor: [1, 2]<br><br>dataType: float32<br>shape: [2]<br>tensor: [3, 4]"
    },
    "switch-sample": {
      order: ["imageClassification", "fastStyleTransfer", "objectDetection"],
      samples: {
        imageClassification: {
          gpu: {
            fp16: ["resNet50V1"]
          },
          cpu: {
            fp32: ["mobileNetV2"]
          }
        },
        fastStyleTransfer: {
          gpu: {
            fp32: ["fastStyleTransfer"]
          },
          examples: ["starryNight"]
        },
        objectDetection: {
          cpu: {
            fp32: ["tinyYoloV2"]
          }
        }
      }
    },
    "switch-backend": {
      rounds: 50,
      samples: {
        imageClassification: {
          cpu: {
            fp32: ["mobileNetV2"]
          },
          gpu: {
            fp16: ["mobileNetV2"]
          },
          npu: {
            fp16: ["mobileNetV2"]
          }
        }
      }
    }
  },
  "developer-preview": {
    "stable-diffusion-1-5": {
      gpu: { fp16: ["textEncoder", "unet", "vaeDecoder", "safetyChecker"] },
      rounds: 2,
      urlArgs: {
        gpu: "",
        npu: ""
      }
    },
    "stable-diffusion-turbo": {
      gpu: { fp16: ["textEncoder", "unet", "vaeDecoder", "safetyChecker"] },
      rounds: 2,
      urlArgs: {
        gpu: "",
        npu: ""
      }
    },
    "segment-anything": {
      gpu: { fp16: ["encoder", "decoder"] },
      urlArgs: { gpu: "", npu: "" },
      imageSpot: {
        x: 0.5,
        y: 0.5
      }
    },
    "whisper-base": {
      gpu: { fp16: ["encoder", "decoder", "decoderKvCache"] },
      npu: { fp16: ["encoder", "decoder", "decoderKvCache"] },
      urlArgs: {
        gpu: "?devicetype=gpu",
        npu: "?devicetype=npu"
      },
      examples: [
        {
          name: "audio_01.wav",
          expectedValue:
            " the dimness of the sealed eye and soul, the dreamy solicitations of indescribable afterthoughts. The dying day lies beautiful in the tender glow of the evening. The early morning of the Indian summer day"
        }
      ]
    },
    "image-classification": {
      cpu: { fp16: ["mobileNetV2", "resNet50", "efficientNetLite4"] },
      gpu: { fp16: ["mobileNetV2", "resNet50", "efficientNetLite4"] },
      npu: { fp16: ["mobileNetV2", "resNet50", "efficientNetLite4"] },
      urlArgs: {
        cpu: { provider: "webnn", devicetype: "cpu", run: 50 },
        gpu: { provider: "webnn", devicetype: "gpu", run: 50 },
        npu: { provider: "webnn", devicetype: "npu", run: 50 },
        mobileNetV2: { model: "mobilenet-v2" },
        resNet50: { model: "resnet-50" },
        efficientNetLite4: { model: "efficientnet-lite4" }
      }
    }
  }
};

const HELP_MESSAGE = `
##### Generate config for sample tests #####

Usage:
  node generate-config.js [options]
OR
  npm run generate-config -- [options]

Options:
      --browser                              [string] [default: "chrome_canary"]
      --devices                           [array] [default: ["cpu","gpu","npu"]]
  -h, --help     Show help                                             [boolean]
`;

const validDevices = ["cpu", "npu", "gpu"];
const validBrowsers = [
  "chrome_canary",
  "chrome_dev",
  "chrome_beta",
  "chrome_stable",
  "edge_canary",
  "edge_dev",
  "edge_beta",
  "edge_stable"
];

(async function () {
  // edge canary not available on linux
  if (process.platform === "linux") {
    const index = validBrowsers.indexOf("edge_canary");
    if (index > -1) {
      validBrowsers.splice(index, 1);
    }
  }

  if (process.argv.length === 3 && (process.argv[2] === "--help" || process.argv[2] === "-h")) {
    console.error(HELP_MESSAGE);
    process.exit();
  }

  const args = yargs(hideBin(process.argv))
    .option("browser", { default: "chrome_canary", type: "string" })
    .option("devices", { default: "cpu,gpu,npu", type: "string" })
    .parse();

  // "_", "$0" are default element after `yargs` parse.
  const validArgs = ["devices", "browser", "_", "$0"];
  const invalidArgs = Object.keys(args).filter((arg) => !validArgs.includes(arg));

  if (invalidArgs.length > 0) {
    console.error(`Invalid arguments: ${invalidArgs.join(", ")}`);
    process.exit(1);
  }

  const { devices, browser } = args;

  // Split devices by comma and validate
  const deviceArray = devices.split(",");
  const invalidDevices = deviceArray.filter((device) => !validDevices.includes(device));
  if (invalidDevices.length > 0) {
    console.error(`Invalid devices: ${invalidDevices.join(", ")}. Please specify valid devices.`);
    process.exit(1);
  }

  if (!validBrowsers.includes(browser)) {
    console.error(`Invalid browser: ${browser}. Please specify a valid browser.`);
    process.exit(1);
  }

  console.log(`browser: ${browser}\ndevices: ${deviceArray}`);

  if (deviceArray.includes("npu") && !(await getNPUInfo())) {
    console.warn("NPU is set but not available on this device. Removing 'npu' from devices.");
    deviceArray.splice(deviceArray.indexOf("npu"), 1);
  }

  const filteredConfig = filterSamplesWithDevices(ORIGINAL_CONFIG, deviceArray);
  filteredConfig.browser = browser;

  fs.writeFileSync("./config.json", JSON.stringify(filteredConfig, null, 2));

  console.log(`./config.json of ${browser} on ${deviceArray.join("-")} has been generated.`);
})();

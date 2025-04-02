const fs = require("fs");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

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
  result.developerPreview = filterDevice(result.developerPreview, devices);

  removeInvalidSamples(result.samples, devices);
  removeInvalidSamples(result.developerPreview, devices);

  return result;
}

// chrome_canary & cpu, npu, gpu by default
const ORIGINAL_CONFIG = {
  browser: "chrome_canary",
  browserArgs: ["--start-maximized"],
  browserArgsWebnn: ["--enable-features=WebMachineLearningNeuralNetwork", "--allow-third-party-modules"],
  browserArgsNpu: ["--ignore-gpu-blocklist"],
  browserUserData: true,
  browserUserDataPath: "",
  browserAppPath: "",
  headless: false,
  timeout: 600000,
  errorMsgMaxLength: 200,
  imageCompareThreshold: 0.1,
  samplesBasicUrl: "https://webmachinelearning.github.io/webnn-samples",
  samplesUrl: {
    faceRecognition: "/face_recognition/",
    facialLandmarkDetection: "/facial_landmark_detection/",
    fastStyleTransfer: "/style_transfer/",
    handwrittenDigitsClassification: "/lenet/",
    imageClassification: "/image_classification/",
    objectDetection: "/object_detection/",
    semanticSegmentation: "/semantic_segmentation/",
    noiseSuppressionNsNet2: "/nsnet2/",
    noiseSuppressionRnNoise: "/rnnoise/",
    codeEditor: "/code/",
    notepad: "/nnotepad/"
  },
  developerPreviewBasicUrl: "https://microsoft.github.io/webnn-developer-preview",
  developerPreviewUrl: {
    stableDiffusion15: "/demos/stable-diffusion-1.5/",
    stableDiffusionTurbo: "/demos/sd-turbo/",
    segmentAnything: "/demos/segment-anything/",
    whisperBase: "/demos/whisper-base/",
    imageClassification: "/demos/image-classification/"
  },
  samples: {
    faceRecognition: {
      cpu: {
        fp32: ["faceNetSsdMobileNetV2Face"]
      },
      gpu: {
        fp32: ["faceNetSsdMobileNetV2Face"]
      }
    },
    facialLandmarkDetection: {
      cpu: {
        fp32: ["simpleCnnSsdMobileNetV2Face"]
      },
      gpu: {
        fp32: ["simpleCnnSsdMobileNetV2Face"]
      }
    },
    fastStyleTransfer: {
      examples: ["starryNight"],
      cpu: {
        fp32: ["fastStyleTransfer"]
      },
      gpu: {
        fp32: ["fastStyleTransfer"]
      }
    },
    handwrittenDigitsClassification: {
      rounds: 3,
      cpu: { fp32: ["leNet"] },
      gpu: { fp32: ["leNet"] }
    },
    imageClassification: {
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
    objectDetection: {
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
    semanticSegmentation: {
      cpu: { fp32: ["deepLabV3MobileNetV2"] },
      gpu: { fp32: ["deepLabV3MobileNetV2"] }
    },
    noiseSuppressionNsNet2: {
      examples: ["babbleNoise", "carNoise", "streetNoise"],
      cpu: { fp32: ["nsNet2"] },
      gpu: { fp32: ["nsNet2"] }
    },
    noiseSuppressionRnNoise: {
      examples: ["backgroundNoise1", "backgroundNoise2", "backgroundNoise3"],
      cpu: { fp32: ["rnNoise"] },
      gpu: { fp32: ["rnNoise"] }
    },
    codeEditor: {
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
    switchSampleTest: {
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
    switchBackendTest: {
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
  developerPreview: {
    stableDiffusion15: {
      gpu: { fp16: ["textEncoder", "unet", "vaeDecoder", "safetyChecker"] },
      rounds: 2,
      urlArgs: {
        gpu: "",
        npu: ""
      }
    },
    stableDiffusionTurbo: {
      gpu: { fp16: ["textEncoder", "unet", "vaeDecoder", "safetyChecker"] },
      rounds: 2,
      urlArgs: {
        gpu: "",
        npu: ""
      }
    },
    segmentAnything: {
      gpu: { fp16: ["encoder", "decoder"] },
      urlArgs: { gpu: "", npu: "" },
      imageSpot: {
        x: 0.5,
        y: 0.5
      }
    },
    whisperBase: {
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
    imageClassification: {
      gpu: { fp16: ["mobileNetV2", "resNet50", "efficientNetLite4"] },
      npu: { fp16: ["mobileNetV2", "resNet50", "efficientNetLite4"] },
      urlArgs: {
        gpu: "?provider=webnn&devicetype=gpu&run=100",
        npu: "?provider=webnn&devicetype=npu&run=100",
        mobileNetV2: "&model=mobilenet-v2",
        resNet50: "&model=resnet-50",
        efficientNetLite4: "&model=efficientnet-lite4"
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
const validBrowsers = ["chrome_canary", "edge_canary", "chrome_beta", "chrome_dev", "chrome_stable", "edge_canary"];

if (process.argv.length === 3 && (process.argv[2] === "--help" || process.argv[2] === "-h")) {
  console.log(HELP_MESSAGE);
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
  console.log(`Invalid arguments: ${invalidArgs.join(", ")}`);
  process.exit(1);
}

const { devices, browser } = args;

// Split devices by comma and validate
const deviceArray = devices.split(",");
const invalidDevices = deviceArray.filter((device) => !validDevices.includes(device));
if (invalidDevices.length > 0) {
  console.log(`Invalid devices: ${invalidDevices.join(", ")}. Please specify valid devices.`);
  process.exit(1);
}

if (!validBrowsers.includes(browser)) {
  console.log(`Invalid browser: ${browser}. Please specify a valid browser.`);
  process.exit(1);
}

console.warn(`browser:${browser}\ndevices:${deviceArray}`);

const filteredConfig = filterSamplesWithDevices(ORIGINAL_CONFIG, deviceArray);

if (browser.startsWith("edge")) {
  filteredConfig.browserArgsNpu.push("--disable_webnn_for_npu=0");
}

if (browser.startsWith("chrome")) {
  filteredConfig.browserArgsWebnn.push("--use-redist-dml");
}

filteredConfig.browser = browser;

fs.writeFileSync("./config.json", JSON.stringify(filteredConfig, null, 2));

console.log(`./config.json of ${browser} on ${deviceArray.join("-")} has been generated.`);

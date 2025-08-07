const fs = require("fs");
const { program, Option } = require("commander");
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

const ORIGINAL_CONFIG = {
  browserArgs: ["--start-maximized"],
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
    "selfie-segmentation": "/selfie_segmentation/",
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
    "selfie-segmentation": {
      cpu: { fp16: ["general"], fp32: ["general"] },
      gpu: { fp16: ["general"], fp32: ["general"] },
      npu: { fp16: ["general"], fp32: ["general"] }
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
      npu: { fp16: ["textEncoder", "unet", "vaeDecoder", "safetyChecker"] },
      rounds: 2,
      urlArgs: {
        gpu: "?devicetype=gpu",
        npu: "?devicetype=npu"
      }
    },
    "stable-diffusion-turbo": {
      gpu: { fp16: ["textEncoder", "unet", "vaeDecoder", "safetyChecker"] },
      npu: { fp16: ["textEncoder", "unet", "vaeDecoder", "safetyChecker"] },
      rounds: 2,
      urlArgs: {
        gpu: "?devicetype=gpu",
        npu: "?devicetype=npu"
      }
    },
    "segment-anything": {
      gpu: { fp16: ["encoder", "decoder"] },
      npu: { fp16: ["encoder", "decoder"] },
      urlArgs: { gpu: "?devicetype=gpu", npu: "?devicetype=npu" },
      imageSpot: {
        x: 0.5,
        y: 0.5
      }
    },
    "whisper-base": {
      cpu: { fp16: ["encoder", "decoder", "decoderKvCache"] },
      gpu: { fp16: ["encoder", "decoder", "decoderKvCache"] },
      npu: { fp16: ["encoder", "decoder", "decoderKvCache"] },
      urlArgs: {
        cpu: "?devicetype=cpu",
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

program
  .name("npm run generate-config --")
  .description("Generate config for webnn sample tests")
  .addOption(
    new Option("-b, --browser <browser>", "The browser to use")
      .choices([
        "chrome_canary",
        "chrome_dev",
        "chrome_beta",
        "chrome_stable",
        "edge_canary",
        "edge_dev",
        "edge_beta",
        "edge_stable"
      ])
      .default("chrome_canary")
  )
  .addOption(
    new Option("-d, --devices <devices...>", "The devices to use")
      .choices(["cpu", "gpu", "npu"])
      .default(["cpu", "gpu", "npu"])
  )
  .addOption(new Option("-e, --backend <backend>", "The backend to use").choices(["ort", "tflite"]).default("ort"))
  .option("-o, --output <path>", "The output config file path", "config.json")
  .action(async ({ devices, browser, backend, output }) => {
    if (process.platform === "linux" && browser === "edge_canary") {
      console.error("edge_canary is not available on linux.");
      return;
    }

    console.log(`browser: ${browser}\ndevices: ${devices}`);
    if (devices.includes("npu") && !(await getNPUInfo())) {
      console.warn("NPU is set but not available on this device. Removing npu from devices.");
      devices.splice(devices.indexOf("npu"), 1);
    }

    const config = { backend, browser, ...filterSamplesWithDevices(ORIGINAL_CONFIG, devices) };
    if (backend === "ort") {
      config.browserArgs.push("--enable-features=WebMachineLearningNeuralNetwork,WebNNOnnxRuntime");
    } else if (backend === "tflite") {
      config.browserArgs.push(
        "--enable-features=WebMachineLearningNeuralNetwork",
        "--disable-features=WebNNDirectML,WebNNOnnxRuntime"
      );
    }

    fs.writeFileSync(output, JSON.stringify(config, null, 2));
    console.log(`Generated ${output} for ${browser} with ${backend} backend on ${devices.join("-")}`);
  })
  .parse();

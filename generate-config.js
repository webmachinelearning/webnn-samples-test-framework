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
      // remove the `switch-sample` if devices do not include cpu & gpu
      // cause the sub samples are executed both on cpu and gpu
      const sample = samples[sampleName];
      if (sampleName === "switch-sample") {
        if (!devices.includes("cpu") || !devices.includes("gpu")) delete samples[sampleName];
      } else if (sampleName === "switch-backend") {
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
    "image-classification": "/demos/image-classification/",
    "text-generation": "/demos/text-generation/"
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
      order: ["image-classification", "fast-style-transfer", "object-detection"],
      samples: {
        "image-classification": {
          gpu: {
            fp16: ["resNet50V1"]
          },
          cpu: {
            fp32: ["mobileNetV2"]
          }
        },
        "fast-style-transfer": {
          gpu: {
            fp32: ["fastStyleTransfer"]
          },
          examples: ["starryNight"]
        },
        "object-detection": {
          cpu: {
            fp32: ["tinyYoloV2"]
          }
        }
      }
    },
    "switch-backend": {
      rounds: 50,
      samples: {
        "image-classification": {
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
      gpu: { fp16: ["all"] },
      npu: { fp16: ["all"] },
      rounds: 2
    },
    "stable-diffusion-turbo": {
      gpu: { fp16: ["all"] },
      npu: { fp16: ["all"] },
      rounds: 2
    },
    "segment-anything": {
      gpu: { fp16: ["all"] },
      npu: { fp16: ["all"] },
      imageSpot: {
        x: 0.5,
        y: 0.5
      }
    },
    "whisper-base": {
      cpu: { fp16: ["all"] },
      gpu: { fp16: ["all"] },
      npu: { fp16: ["all"] },
      examples: [
        {
          name: "audio_01.wav",
          expectedValue:
            " the dimness of the sealed eye and soul, the dreamy solicitations of indescribable afterthoughts. The dying day lies beautiful in the tender glow of the evening. The early morning of the Indian summer day"
        }
      ]
    },
    "image-classification": {
      cpu: { fp16: ["mobilenet-v2", "resnet-50", "efficientnet-lite4"] },
      gpu: { fp16: ["mobilenet-v2", "resnet-50", "efficientnet-lite4"] },
      npu: { fp16: ["mobilenet-v2", "resnet-50", "efficientnet-lite4"] },
      urlArgs: { provider: "webnn", run: 50 }
    },
    "text-generation": {
      cases: [
        {
          question: "What is the chemical symbol for the element Oxygen? Provide only the symbol.",
          answer: "O"
        },
        {
          question: "Answer with only the number. What is the square of 15?",
          answer: "225"
        },
        {
          question: "Please state only the name of the only satellite of the Earth, without the article.",
          answer: "Moon"
        },
        {
          question: "What is the capital city of the People's Republic of China? Provide only the city name.",
          answer: "Beijing"
        },
        {
          question: "Please provide only the full name of the proposer of the theory of relativity.",
          answer: "Albert Einstein"
        },
        {
          question: "List the twelve months of a year in order, separated by commas. No other text.",
          answer: "January, February, March, April, May, June, July, August, September, October, November, December"
        }
      ],
      cpu: { fp16: ["phi4mini"] },
      gpu: { fp16: ["phi4mini"] },
      npu: { fp16: ["phi4mini"] }
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
  .addOption(
    new Option("-e, --backend <backend>", "The backend to use")
      .choices(["ort", "tflite", "openvino-plugin"])
      .default("ort")
  )
  .option(
    "-p, --onnxruntime-providers-path <path>",
    "The ONNX Runtime plugin and OpenVINO EP path",
    "C:\\Program Files\\ort-ov-plugin-for-sample-test"
  )
  .option("-o, --output <path>", "The output config file path", "config.json")
  .action(async ({ devices, browser, backend, onnxruntimeProvidersPath, output }) => {
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
      config.browserArgs.push(
        "--enable-features=WebMachineLearningNeuralNetwork,WebNNOnnxRuntime",
        "--disable_webnn_for_npu=0"
      );
    } else if (backend === "tflite") {
      config.browserArgs.push(
        "--enable-features=WebMachineLearningNeuralNetwork",
        "--disable-features=WebNNDirectML,WebNNOnnxRuntime"
      );

      const tfliteUnsupportedModels = ["efficientNet", "resNet50V1"];
      const filterModels = (models) => models.filter((model) => !tfliteUnsupportedModels.includes(model));
      const nonCpuDevices = devices.filter((device) => device !== "cpu");
      for (const device of nonCpuDevices) {
        config.samples["image-classification"][device].fp16 = filterModels(
          config.samples["image-classification"][device].fp16
        );
      }
      const switchImageClassification = config.samples["switch-sample"]?.samples?.["image-classification"];
      if (switchImageClassification) {
        for (const device of nonCpuDevices) {
          if (switchImageClassification[device]?.fp16) {
            switchImageClassification[device].fp16 = filterModels(switchImageClassification[device].fp16);
            if (switchImageClassification[device].fp16.length === 0) delete switchImageClassification[device];
          }
        }
      }
    } else if (backend === "openvino-plugin") {
      console.log(`Using ONNX Runtime and OpenVINO EP path: ${onnxruntimeProvidersPath}`);
      config.browserArgs.push(
        "--enable-features=WebNNOnnxRuntime,WebMachineLearningNeuralNetwork",
        `--webnn-ort-library-path-for-testing=${onnxruntimeProvidersPath}`,
        `--webnn-ort-ep-library-path-for-testing=OpenVINOExecutionProvider?${onnxruntimeProvidersPath}\\onnxruntime_providers_openvino_plugin.dll`,
        "--allow-third-party-modules",
        "--disable_webnn_for_npu=0"
      );
    }

    fs.writeFileSync(output, JSON.stringify(config, null, 2));
    console.log(`Generated ${output} for ${browser} with ${backend} backend on ${devices.join("-")}`);
  })
  .parse();

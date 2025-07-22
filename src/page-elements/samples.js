const pageElement = {
  // public element
  alertWarning: ".alert-warning > span", // css selector
  // model load result
  loadTime: "#loadTime",
  buildTime: "#buildTime",
  computeTime: "#computeTime",
  // data type
  fp32: "#float32",
  fp16: "#float16",
  // backend
  backendText: "//span[text()='Backend']", // xpath selector
  wasm: "#polyfill_cpu",
  webgl: "#polyfill_gpu",
  cpu: "#webnn_cpu",
  gpu: "#webnn_gpu",
  npu: "#webnn_npu",
  // model
  mobileNetV2: "#mobilenet",
  squeezeNet: "#squeezenet",
  resNet50V1: "#resnet50v1",
  resNet50V2: "#resnet50v2",
  efficientNet: "#efficientnet",
  tinyYoloV2: "#tinyyolov2",
  ssdMobileNetV1: "#ssdmobilenetv1",
  deepLabV3MobileNetV2: "#deeplabv3mnv2",
  // canvas
  objectDetectionCanvas: "#outputCanvas",
  handwrittenDigitsClassificationCanvas: "#visual_canvas",
  fastStyleTransferInputCanvas: "#inputCanvas",
  fastStyleTransferOutputCanvas: "#outputCanvas",
  semanticSegmentationCanvas: "#outputCanvas",
  faceRecognitionTargetCanvas: "#targetCanvasShow",
  faceRecognitionSearchCanvas: "#searchCanvasShow",
  facialLandmarkDetectionCanvas: "#outputCanvas",
  // image classification page
  label0: "#label0",
  prob0: "#prob0",
  label1: "#label1",
  prob1: "#prob1",
  label2: "#label2",
  prob2: "#prob2",
  // fast style transfer page
  starryNight: "#starry-night",
  selfPortrait: "#self-portrait",
  bedroom: "#bedroom",
  sunflowersBew: "#sunflowers-bew",
  redVineyards: "#red-vineyards",
  sienWithACigar: "#sien-with-a-cigar",
  laCampesinos: "#la-campesinos",
  soupDistribution: "#soup-distribution",
  wheatFieldWithCrows: "#wheatfield_with_crows",
  // code editor page
  codeLine: ".CodeMirror-line",
  runButton: "#run",
  editButton: "#edit",
  exampleSelect: "#example-select",
  consoleLog: "#console-log",
  // notepad page
  deviceTypeSelect: "#device",
  outputText: "#output",
  // face recognition page
  faceNet: "#facenet",
  ssdMobileNetV2Face: "#ssdmobilenetv2face",
  // facial landmark detection page
  simpleCnn: "#facelandmark",
  // handwritten digits classification page
  nextButton: "#next",
  clearButton: "#clear",
  predictButton: "#predict",
  handwrittenDigitsBuildTime: "#buildTime > span",
  handwrittenDigitsInferenceTime: "#inferenceTime > span",
  // noise suppression nsnet2 page
  loadInfoTextRows: "#info > .text-primary",
  deNoiseInfoTextRows: "#denoise-info > .text-primary",
  readyText: "//b[text()='ready']",
  doneText: "//b[text()='Done.']",
  chooseAudioButton: "#choose-audio",
  babbleNoise: "#babble",
  carNoise: "#car",
  streetNoise: "#street",
  // noise suppression rnnoise page
  backgroundNoise1: "#voice1",
  backgroundNoise2: "#voice2",
  backgroundNoise3: "#voice3"
};

module.exports = pageElement;

const pageElements = {
  stableDiffusion15: {
    loadModelsButton: "#load_models",
    generateImageButton: "#generate_next_image",
    progressBarLabel: "#progress-bar-label",
    progressBarLabelInference: "#progress-bar-label-inference",
    alertWaring: "#info",
    textEncoderTr: "#textencoder",
    textEncoderLoad: "#textencoderload",
    textEncoderFetch: "#textencoderfetch",
    textEncoderCreate: "#textencodercreate",
    textEncoderRun: "#textencoderrun",
    unetTr: "#unet",
    unetLoad: "#unetload",
    unetFetch: "#unetfetch",
    unetCreate: "#unetcreate",
    unetRun: "#unetrun",
    vaeDecoderTr: "#vaedecoder",
    vaeDecoderLoad: "#vaedecoderload",
    vaeDecoderFetch: "#vaedecoderfetch",
    vaeDecoderCreate: "#vaedecodercreate",
    vaeDecoderRun: "#vaedecoderrun",
    safetyCheckerTr: "#sc",
    safetyCheckerLoad: "#scload",
    safetyCheckerFetch: "#scfetch",
    safetyCheckerCreate: "#sccreate",
    safetyCheckerRun: "#scrun",
    totalTr: "#total",
    totalLoad: "#totalload",
    totalFetch: "#totalfetch",
    totalCreate: "#totalcreate",
    totalRun: "#totalrun"
  },
  stableDiffusionTurbo: {
    loadModelsButton: "#load",
    generateImageButton: "#generate",
    // Text Encoder
    textEncoderFetch: "#textEncoderFetch",
    textEncoderCreate: "#textEncoderCreate",
    textEncoderRun1: "#textEncoderRun1",
    textEncoderRun2: "#textEncoderRun2",
    textEncoderRun3: "#textEncoderRun3",
    textEncoderRun4: "#textEncoderRun4",
    // Unet
    unetFetch: "#unetFetch",
    unetCreate: "#unetCreate",
    unetRun1: "#unetRun1",
    unetRun2: "#unetRun2",
    unetRun3: "#unetRun3",
    unetRun4: "#unetRun4",
    // VAE
    vaeFetch: "#vaeFetch",
    vaeCreate: "#vaeCreate",
    vaeRun1: "#vaeRun1",
    vaeRun2: "#vaeRun2",
    vaeRun3: "#vaeRun3",
    vaeRun4: "#vaeRun4",
    // Total Execution Time = Session Run (Text Encoder + UNet + VAE Decoder) + Image Drawing
    runTotal1: "#runTotal1",
    runTotal2: "#runTotal2",
    runTotal3: "#runTotal3",
    runTotal4: "#runTotal4",
    // Safety Checker
    scFetch: "#scFetch",
    scCreate: "#scCreate",
    scRun1: "#scRun1",
    scRun2: "#scRun2",
    scRun3: "#scRun3",
    scRun4: "#scRun4",
    // data show
    data1: "#data1",
    data2: "#data2",
    data3: "#data3",
    data4: "#data4"
  },
  segmentAnything: {
    logPanel: "#log",
    progressInfo: "#progress-info",
    imgCanvas: "#img_canvas",
    decoderLatency: "#decoder_latency"
  },
  whisperBase: {
    uploadButton: "#label-file-upload",
    uploadInput: "#file-upload",
    recordButton: "#record",
    speechButton: "#speech",
    outputText: "#outputText",
    latency: "#latency"
  },
  imageClassification: {
    classifyButton: "#classify-image",
    median: "#median",
    first: "#first",
    best: "#best",
    average: "#average",
    throughput: "#throughput",
    result: "#result",
    label1: "#label1",
    score1: "#score1",
    label2: "#label2",
    score2: "#score2",
    label3: "#label3",
    score3: "#score3"
  }
};

module.exports = pageElements;

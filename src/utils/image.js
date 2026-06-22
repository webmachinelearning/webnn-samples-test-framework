const fs = require("fs");
const path = require("path");
const { createCanvas, Image, loadImage } = require("canvas");
const { ensureDir, outDir } = require("./fs");
const { getTimestamp } = require("./common");

async function saveCanvasImage(page, canvas_element, filename) {
  try {
    const canvas = await page.$(canvas_element);
    // get Canvas data URL
    const canvasDataURL = await page.evaluate((canvas) => {
      return canvas.toDataURL();
    }, canvas);

    //  transform URL to Buffer
    const base64Data = canvasDataURL.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // save image
    const timestamp = getTimestamp();
    const canvasPath = `${outDir}/${timestamp}/canvas_image/${filename}.png`;
    ensureDir(path.dirname(canvasPath));
    fs.writeFileSync(canvasPath, buffer);

    return { canvasPath };
  } catch (error) {
    console.log("canvas image save fail", error);
  }
}

function compareImages(imagePath1, imagePath2) {
  function loadImageSync(imagePath) {
    const image = new Image();
    const buffer = fs.readFileSync(imagePath);
    image.src = buffer;
    return image;
  }

  const image1 = loadImageSync(imagePath1);
  const image2 = loadImageSync(imagePath2);

  if (image1.width !== image2.width || image1.height !== image2.height) {
    return 0; // Return 0% similarity if dimensions do not match
  }

  const canvas1 = createCanvas(image1.width, image1.height);
  const ctx1 = canvas1.getContext("2d");
  ctx1.drawImage(image1, 0, 0);
  const data1 = ctx1.getImageData(0, 0, image1.width, image1.height).data;

  const canvas2 = createCanvas(image2.width, image2.height);
  const ctx2 = canvas2.getContext("2d");
  ctx2.drawImage(image2, 0, 0);
  const data2 = ctx2.getImageData(0, 0, image2.width, image2.height).data;

  let totalDiff = 0;

  for (let i = 0; i < data1.length; i += 4) {
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
    const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);

    totalDiff += rDiff + gDiff + bDiff;
  }

  const maxDiff = (data1.length / 4) * 255 * 3;
  const similarity = ((maxDiff - totalDiff) / maxDiff) * 100;

  return similarity;
}

async function checkImageGeneration(imagePath, sampleName = "stable-diffusion-turbo") {
  const histogramFilePath = path.resolve(__dirname, "..", "..", "assets", "canvas", sampleName, "histograms.json");

  async function getImageData(path) {
    const img = await loadImage(path);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, img.width, img.height);
    return ctx.getImageData(0, 0, img.width, img.height);
  }

  function getColorHistogram(imageData, binsPerChannel = 4) {
    const totalBins = binsPerChannel ** 3;
    const hist = new Array(totalBins).fill(0);
    const data = imageData.data;
    const totalPixels = imageData.width * imageData.height;
    const shift = 8 - Math.log2(binsPerChannel);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] >> shift;
      const g = data[i + 1] >> shift;
      const b = data[i + 2] >> shift;
      const bin = r * binsPerChannel * binsPerChannel + g * binsPerChannel + b;
      hist[bin]++;
    }
    return { hist, totalPixels };
  }

  function histogramIntersection(hist1, hist2) {
    let intersection = 0;
    for (let i = 0; i < hist1.length; i++) {
      intersection += Math.min(hist1[i], hist2[i]);
    }
    return intersection;
  }

  async function compareImagesHistogram(testFilepath, binsPerChannel = 4) {
    const imageData = await getImageData(testFilepath);

    const { hist: hist1, totalPixels } = getColorHistogram(imageData, binsPerChannel);
    const histogramsTemplate = JSON.parse(fs.readFileSync(histogramFilePath, "utf-8"));
    let maxSimilarity = 0;

    for (const template of histogramsTemplate) {
      const intersection = histogramIntersection(hist1, template);
      const similarity = (intersection / totalPixels) * 100;
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  return await compareImagesHistogram(imagePath);
}

module.exports = {
  saveCanvasImage,
  compareImages,
  checkImageGeneration
};

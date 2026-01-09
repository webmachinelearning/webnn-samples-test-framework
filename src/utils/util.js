const envUtils = require("./env");
const commonUtils = require("./common");
const fsUtils = require("./fs");
const browserUtils = require("./browser");
const pageUtils = require("./page");
const imageUtils = require("./image");
const dataUtils = require("./data");
const deviceUtils = require("./device");

module.exports = {
  ...envUtils,
  ...commonUtils,
  ...fsUtils,
  ...browserUtils,
  ...pageUtils,
  ...imageUtils,
  ...dataUtils,
  ...deviceUtils
};

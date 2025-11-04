const fs = require("fs");

module.exports = async function ({ config }) {
  let errors = [];
  config.browserArgs.forEach((arg) => {
    const match = arg.match(/--webnn-ort-library-path-for-testing=([^"]+)/);
    if (match) {
      if (!fs.existsSync(`${match[1]}/onnxruntime.dll`)) {
        errors.push(
          `The specified --webnn-ort-library-path-for-testing="${match[1]}" directory does not contain onnxruntime.dll`
        );
      }
    } else {
      const match = arg.match(/--webnn-ort-ep-library-path-for-testing=.*\?(.*)/);
      if (match && !fs.existsSync(match[1])) {
        errors.push(`The specified file in ${arg} does not exist`);
      }
    }
  });
  return errors.length > 0 ? { error: errors } : {};
};

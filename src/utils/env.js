function getEnv() {
  if (process.env.APP_ENV) {
    return require(`../../env.${process.env.APP_ENV}.json`);
  } else {
    return require("../../env.json");
  }
}

const env = getEnv();

module.exports = {
  getEnv,
  env
};

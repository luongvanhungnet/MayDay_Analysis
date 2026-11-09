const handler = require('./apps/api/dist/main').default;

module.exports = async (req, res) => {
  return handler(req, res);
};

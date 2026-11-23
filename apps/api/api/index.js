const handler = require('../dist/main').default;

module.exports = async (req, res) => {
  return handler(req, res);
};

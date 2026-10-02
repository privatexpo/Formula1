const { adapt } = require("./_adapt");

exports.handler = adapt(require("../../api/checkout"));

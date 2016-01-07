'use strict';

/**
 * TCP Tunnel
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

const createDebug = require('debug');
const utils = module.exports = exports = require('lei-utils').extend({});


/**
 * create debug function
 *
 * @param {String} name
 * @return {Function}
 */
utils.debug = function (name) {
  return createDebug('tcp-tunnel:' + name);
};

const debug = utils.debug('utils');

/**
 * sign JSON data
 *
 * @param {String} token
 * @param {Object} data
 * @param {Boolean} noCommonFields
 * @return {Object}
 */
utils.sign = function (token, data, noCommonFields) {
  if (!noCommonFields) {
    data.noncestr = utils.randomString(16);
    data.timestamp = Date.now();
    data.version = '1.0';
  }
  debug('sign: token=%s, data=%j', token, data);
  const keys = Object.keys(data).sort();
  const i = keys.indexOf('sign');
  if (i !== -1) keys.splice(i, 1);
  const str = token + keys.map(k => `${k}${data[k]}`).join('') + token;
  data.sign = utils.md5(str).toUpperCase();
  debug('sign: sign=%s, str=%s', data.sign, str);
  return data;
};

/**
 * sign JSON data and stringify it
 *
 * @param {String} token
 * @param {Object} data
 * @return {String}
 */
utils.signJSON = function (token, data) {
  return utils.tryStringifyJSON(utils.sign(token, data));
};

/**
 * verify JSON data
 *
 * @param {String} token
 * @param {Object} data
 * @return {Boolean}
 */
utils.verifySign = function (token, data) {
  return (data.noncestr && utils.verifyTimestamp(data.timestamp) &&
          utils.sign(token, data, true).sign === data.sign);
};

/**
 * verify timestamp
 *
 * @param {Number} timestamp
 * @param {Number} tolerance
 * @return {Boolean}
 */
utils.verifyTimestamp = function (timestamp, tolerance) {
  tolerance = tolerance || 10000;
  return (Math.abs(Date.now() - timestamp) <= tolerance);
};

/**
 * try parse JSON
 *
 * @param {String} data
 * @return {Mixed}
 */
utils.tryParseJSON = function (data) {
  debug('tryParseJSON: %s', data);
  try {
    return JSON.parse(data.toString());
  } catch (err) {}
};

/**
 * try stringify JSON
 *
 * @param {Mixed} data
 * @return {String}
 */
utils.tryStringifyJSON = function (data) {
  return utils.jsonStringify(data, 0);
};

/**
 * parse config
 *
 * @param {String} text
 * @return {Object}
 */
utils.parseConfig = function (text) {
  const conf = {};
  const errs = [];
  let curr = '';

  let pushSyntaxError = (l, c) => {
    errs.push(`[${c}] syntax error in line ${l.num}: ${l.text}`);
  };

  text.split(/\n/).forEach((line, num) => {
    line = line.trim();

    // comment line
    if (line[0] === '#') return;

    // collection start
    if (line[0] === ':') {
      curr = line.slice(1).trim();
      if (!Array.isArray(conf[curr])) conf[curr] = [];
      return;
    }

    // config item
    conf[curr].push({text: line, num: num});

  });

  // parse :client
  if (Array.isArray(conf.client)) {
    const client = {};
    conf.client.forEach(line => {
      const i = line.text.indexOf(':');
      if (i === -1) return pushSyntaxError(line, 'client');
      const n = line.text.slice(0, i).trim();
      const p = line.text.slice(i + 1).trim();
      client[n] = p;
    });
    conf.client = client;
  }

  // parse :rule
  if (Array.isArray(conf.rule)) {
    const rule = {};
    conf.rule.forEach(line => {
      const i = line.text.indexOf('->');
      const j = line.text.indexOf(':', i);
      if (i === -1 || j === -1) return pushSyntaxError(line, 'rule');
      const p = Number(line.text.slice(0, i).trim());
      const cn = line.text.slice(i + 2, j).trim();
      const cp = Number(line.text.slice(j + 1).trim());
      if (isNaN(p) || isNaN(cp)) return pushSyntaxError(line, 'rule');
      rule[p] = {client: cn, port: cp};
    });
    conf.rule = rule;
  }

  // parse :data
  if (Array.isArray(conf.data)) {
    const data = {};
    conf.data.forEach(line => {
      const i = line.text.indexOf('=');
      if (i === -1) return pushSyntaxError(line, 'data');
      const n = line.text.slice(0, i).trim();
      const v = line.text.slice(i + 1).trim();
      data[n] = v;
    });
    conf.data = data;
  }

  // parse :global
  if (Array.isArray(conf[''])) {
    conf['global'] = conf[''].map(line => line.text);
    delete conf[''];
  }

  return {config: conf, error: errs};
};

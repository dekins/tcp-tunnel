#!/usr/bin/env node

'use strict';

/**
 * TCP Tunnel
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

const fs = require('fs');
const path = require('path');
const program = require('commander');
const clc = require('cli-color');
const utils = require('../lib/utils');
const TCPTunnelClient = require('../client');
const packageInfo = require('../package.json');
const logger = utils.createLogger();


program
  .version(packageInfo.version)
  .option('-c, --config <config_file>', 'specify a config file')

const printHelp = _ => {
  const help = clc.yellow(`
  Usage:

    $ ttclient -c [config-file]

  For more details, please see: https://npmjs.org/package/tcp-tunnel
  `);
  console.log(help);
};
program.on('--help', printHelp);

program.parse(process.argv);


if (!program.config) {
  printHelp();
  utils.die('please specify a config file!');
}
if (!fs.existsSync(program.config)) utils.die(`config file ${program.config} does not exists`);

logger.info(`load config file ${program.config}`);
const parseConfigResult = utils.parseConfig(fs.readFileSync(program.config).toString());
if (parseConfigResult.error.length > 0) utils.die(`parse config file error:\n${parseConfigResult.error.join('\n')}`);
const config = parseConfigResult.config;


const clientOptions = {
  host: config.value.server,
  port: config.value.serverPort,
  name: config.value.name,
  password: config.value.password,
};
let connectrdOnStartup = false;

function initClient(exit) {

  const client = new TCPTunnelClient(clientOptions);

  client.on('connect', _ => {
    connectrdOnStartup = true;
    logger.info('service PID#%s connected to server %s:%s', process.pid, clientOptions.host, clientOptions.port);
  });

  client.on('server verify failed', _ => {
    logger.error('verify password failed, going to shutdown...');
    process.exit(1);
  });

  client.on('error', err => {
    logger.error('an error has been occurred: %s', err.message);
    client.exit();
    retry(err);
  });

  client.on('server verified', _ => {
    logger.info('verify password succeed');
  });

  client.on('server message', msg => {
    logger.info('message from server: %s', msg);
  });

  client.on('new session', (localPort, remotePort) => {
    logger.log('new session: %s:%s <=> %s:%s', '127.0.0.1', localPort, clientOptions.host, remotePort);
  });

  client.on('proxy local connect', p => {
    logger.debug('proxy connected to %s:%s', p.local.remoteAddress, p.local.remotePort);
  });

  client.on('proxy remote connect', p => {
    logger.debug('proxy connected to %s:%s', p.remote.remoteAddress, p.remote.remotePort);
  });

  client.on('proxy local close', p => {
    logger.debug('proxy connection closed from %s:%s', p.local.remoteAddress, p.local.remotePort);
  });

  client.on('proxy remote close', p => {
    logger.debug('proxy connection closed from %s:%s', p.remote.remoteAddress, p.remote.remotePort);
  });

  client.on('proxy local error', (p, err) => {
    logger.warn('proxy got an error form %s:%s: %s', p.local.remoteAddress, p.local.remotePort, err);
  });

  client.on('proxy remote error', (p, err) => {
    logger.warn('proxy got an error form %s:%s: %s', p.remote.remoteAddress, p.remote.remotePort, err);
  });

}

function retry(err) {
  if (!connectrdOnStartup) {
    logger.error('cannot connect to server %s:%s', clientOptions.host, clientOptions.port);
    process.exit(2);
  }
  /*if (err.code !== 'ECONNREFUSED') {
    logger.error('going to shutdown...');
    process.exit(3);
  }*/
  logger.warn('try to reconnect after 5s ...');
  setTimeout(_ => {
    initClient(retry);
  }, 5000);
}

initClient(retry);


process.on('exit', code => {
  logger.warn('process exit with code %s', code);
});

process.on('SIGINT', _ => {
  logger.warn('got SIGINT, going to shutdown...');
  process.exit();
});

process.on('SIGHUP', _ => {
  logger.warn('go SIGHUP, going to reload config...');
  process.exit();
});

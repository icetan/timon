#!/usr/bin/env node

var argv = require('minimist')(process.argv.slice(2)),

    commands = {
      test: require('./lib/test'),
      report: require('./lib/report'),
      collect: require('./lib/collect'),
      dispatch: require('./lib/dispatch')
    },
    timeout;

function usage(command) {
  if (command) {
    console.log(commands[command].help);
  } else {
    console.log(
      "Usage: timon COMMAND OPTIONS\n\n"+
      "Commands: test, report, collect, dispatch\n"
    );
  }
  process.exit(0);
}

function next() {
  commands[argv._[0]](argv, function(err) {
    process.exit(err ? (err.code || 1) : 0);
  });
}

if (!module.parent) {
  if (argv._[0] === 'help' || argv._.length < 1) usage(argv._[1]);
  next();
} else {
  module.exports = commands;
}

var http = require('http'),

    readStream = require('./util').readStream,
    readJSONStream = require('./util').readJSONStream,

    data = '';

function send(opt, data, callback) {
  var data = {
        data: data,
        status: opt.status
      },
      hostport, req;

  if (opt.dry) {
    if (opt.v || opt.verbose) console.log(data);
    return callback();
  }

  hostport = opt.host.split(':');
  req = http.request({
    hostname: hostport[0],
    port: parseInt(opt.port) || parseInt(hostport[1]) || 80,
    path: '/status/' + opt.name,
    method: 'PUT',
    headers: { 'Content-Type':'application/json' }
  }, function(res) {
    var data = '';
    res.setEncoding('utf8');
    res.on('data', function (chunk) { data += chunk; });
    res.on('end', function (chunk) {
      if (res.statusCode === 200) {
        if (opt.v || opt.verbose) console.log(data);
        callback();
      } else {
        callback(new Error(res.statusCode));
      }
    });
  })

  req.on('error', function(e) { callback(e); });

  req.write(JSON.stringify(data));
  req.end();
}

function parse(opt, callback) {
  function next(err, data) {
    var severities = opt.severity ?
      opt.severity.split(',').map(function(x){return x.trim()}) :
      [ 'ok', 'not ok', 'warn', 'critical' ];
    if (err) return callback(err);
    if (opt.json) {
      if (!opt.status) {
        opt.status = data.tests.reduce(function(p, c) {
          var sev = c.fail && c.fail.severity;
          if (!sev) return p;
          return severities.indexOf(p) < severities.indexOf(sev) ? sev : p;
        }, severities[0]);
        if (!data.ok && opt.status === severities[0])
          opt.status = severities[1];
      }
    }
    send(opt, data, callback);
  }
  if (opt.data != null) {
    if (opt.json)
      next(null, JSON.parse(opt.data));
    else
      next(null, opt.data);
  } else {
    if (opt.json)
      readJSONStream(process.stdin, next);
    else
      readStream(process.stdin, next);
  }
}

module.exports = parse;

module.exports.help =
  "Usage: timon report OPTIONS\n\n" +
  "Options: --json, --data <report data>, -v or --verbose, "+
    "--host <collector host>[:<port>], "+
    "--name <rig name>, --severity "+
      "<comma seperated list of severities in ascending order of importans>, "+
    "--status <rig status>, --dry";

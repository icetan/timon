exports.readStream = readStream;
function readStream(s, callback) {
  var data = '';
  s.resume();
  s.setEncoding('utf8');
  s.on('data', function(chunk) { data += chunk; });
  s.on('error', function(chunk) { callback(err); });
  s.on('end', function() { callback(null, data); });
};

exports.readJSONStream = readJSONStream;
function readJSONStream(s, callback) {
  readStream(s, function(err, data) {
    var obj;
    if (err) return callback(err);
    try {
      obj = JSON.parse(data
        .replace(/^[^"[{0-9.]+/, '')
        .replace(/[^"\]}0-9.]+$/, ''));
    } catch(ex) {
      return callback(ex);
    }
    callback(null, obj);
  });
};

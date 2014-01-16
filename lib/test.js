var path = require('path'),
    fs = require('fs'),
    util = require('util'),

    readJSONStream = require('./util').readJSONStream,

    log = console.log.bind(console);

function comment() {
  arguments[0] = '# '+arguments[0];
  log.apply(console, arguments);
}

function addComment() {
  //if (!this.meta) this.meta = {};
  //if (!this.meta.comments) this.meta.comments = [];
  this.push(util.format.apply(util, arguments));
}

function sync(list, forEach, callback) {
  var current = list.shift();
  if (!current) return callback();
  forEach(current, function() {
    sync(list, forEach, callback);
  });
}

function loadSubjects(opt, callback) {
  var tests = [],
      count = 0,
      comments = [],
      result = {
        ok: true,
        pass: 0,
        tests: []
      };

  function logTest(r) {
    var meta, head;

    if (r == null) return;

    if (r.ok) result.pass++;
    else result.ok = false;

    result.tests.push(r);

    if (opt.onlog) {
      meta = r.meta;
      head = (r.ok?'':'not ')+'ok '+meta['#'];
      opt.onlog(head+' '+r.desc);
      if (!r.ok && r.fail) {
        opt.onlog('  ---'+
          require('yamlish').encode(
            opt.verbose ? r.fail : { message:r.fail.message }, null, 2));
        opt.onlog('  ...');
      }
    }
  }

  function getTester(meta_) {
    function addTest(title, meta, fn) {
      var i;
      if (typeof title === 'object') return getTester(title);
      if (!fn) (fn = meta, meta = null);
      if (!meta) meta = {};
      for (i in meta_) if (meta[i] == null) meta[i] = meta_[i];
      var res = {
            ok: true,
            desc: title.replace(/\{\{(.*?)\}\}/g, function(_, a) {
              return meta[a];
            }),
            meta: { '#':++count }
          },
          i;

      for (i in meta) res.meta[i] = meta[i];

      try {
        if (fn) fn(meta);
      } catch(ex) {
        res.ok = false;
        if (typeof ex === 'string') ex = { message: ex };
        res.fail = ex;
      }

      if (comments.length) res.meta.comments = comments;
      comments = [];

      logTest(res);
    }
    addTest.async = function() {
      addTest.async_ = true;
      return addTest.done_;
    };
    addTest.severity = function(severity, fn) {
      try { fn(); } catch(ex) { ex.severity = severity; throw ex; }
    };
    addTest.data = meta_;
    return addTest;
  }
  var tester = getTester(opt.data);

  if (opt.onlog) opt.onlog('TAP version 13');

  sync(opt.subjects.slice(), function(file, next) {
    var log_ = console.log,
        filepath = path.resolve(process.cwd(), file),
        test = require(fs.existsSync(filepath) ? filepath : file);
    console.log = function() {
      var args = arguments;
      addComment.apply(comments, args);
      if (opt.onlog) {
        args[0] = '# '+args[0];
        opt.onlog.apply(null, args);
      }
    }
    tester.async_ = false;
    tester.done_ = next;
    try {
      test(tester);
    } finally {
      console.log = log_;
    }
    if (!tester.async_) next();
  }, function() {
    if (opt.onlog) opt.onlog('1..'+count);

    if (opt.onlog) {
      opt.onlog('# tests '+count);
      opt.onlog('# pass '+result.pass);
      opt.onlog('# '+(result.ok?'':'not ')+'ok');
    }
    callback(null, result);
  });
}

module.exports = function(argv, callback) {
  function done(err, result) {
    if (err) {
      if (argv.json) {
        result = {
          ok: false,
          fail: "Error while running tests: "+err
        };
      } else {
        console.error(err);
      }
    }
    if (argv.json) log(JSON.stringify(result, null, 2));
    callback(err);
  }

  function next(err, obj) {
    if (err) return done(err);
    loadSubjects({
      data: obj,
      subjects: argv._.slice(1),
      verbose: argv.v || argv.verbose,
      onlog: argv.json ? null : log
    }, done);
  }

  if (argv.data != null) {
    next(null, argv.data);
  } else {
    readJSONStream(process.stdin, next);
  }
};

module.exports.help =
  "Usage: timon test OPTIONS testfiles...\n\n" +
  "Options: --json, --data, -v or --verbose";

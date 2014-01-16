var path = require('path'),
    fs = require('fs'),

    mongoose = require('mongoose'),

    schema = require('./schema');

function checkStale(callback, dry) {
  var Status = mongoose.model('status', schema.status),
      Event = mongoose.model('event', schema.event),
      query = { updated:{ $lt:Date.now() - schema.status.STALE_TIME } };
  Status.find(query, function(err, docs) {
    if (err) return callback(err);
    if (!docs.length) return callback(null, 0);

    var statusMap = docs.reduce(function(p, c) {
          return (p[c.name] = c, p);
        }, {}),
        names = Object.keys(statusMap),
        query = {
          status: 'stale',
          $or: docs.map(function(d) {
            return { $and: [ { name:d.name }, { update:d.update } ] };
          })
        };

    Event.find(query, function(err, docs) {
      if (err) return callback(err);

      var reged = docs.map(function(d) { return d.name; }),
          new_ = names.filter(function(name) {
            return reged.indexOf(name) === -1;
          }).map(function(name) {
            var status = statusMap[name];
            return {
              name: name,
              update: status.update,
              data: status.data,
              status: 'stale',
              previous: status.updated
            };
          })
      if (new_.length) {
        if (dry) {
          callback(null, new_.length);
        } else {
          Event.create(new_, function(err, docs) {
            callback(err, new_.length);
          });
        }
      } else {
        callback(null, 0);
      }
    });
  });
}

function main(opt, callback) {
  var Status = mongoose.model('status', schema.status),
      Event = mongoose.model('event', schema.event),
      Check = mongoose.model('check', schema.check);

  function dispatch(events, callback) {
    var count = opt.names.length, errs;
    function next() {
      if (--count === 0) callback(errs ? {
        message: "Error in dispatch module(s) \"" +
          Object.keys(errs).join('", "') + "\".",
        inner: errs
      } : null);
    }
    opt.names.forEach(function(file) {
      var dispatcher, filepath;
      if (file === '-') {
        console.log(JSON.stringify(events));
        next();
      } else {
        filepath = path.resolve(process.cwd(), file);
        dispatcher = require(fs.existsSync(filepath) ? filepath : file);
        if (opt.dry) {
          console.error("Required but not running module \""+file+"\".");
          next();
        } else {
          dispatcher(events, function(err) {
            if (err) {
              if (!errs) errs = {};
              errs[file] = err;
              console.error(err);
            }
            next();
          });
        }
      }
    });
  }

  Check.findOne({}, function(err, doc) {
    var opt = { limit:100 },
        query = {};
    if (err) return callback(err);
    if (doc) query.created = { $gt:doc.date };

    Event.find(query, null, opt, function(err, docs) {
      if (err) return callback(err);
      function save(err) {
        if (opt.dry) return;
        if (err) return callback(err);
        var query = { _id:doc ? doc._id : new mongoose.Types.ObjectId };
        Check.findOneAndUpdate(query, { $set:{ date:new Date() } },
          { upsert:true }, function(err, doc) {
            if (err) return callback(err);
            callback();
          });
      }
      console.error(docs.length+" event(s) since last notification.");
      if (docs.length) {
        dispatch(docs.reduce(function(p, c) {
          if (!p[c.name]) p[c.name] = [];
          return (p[c.name].push(c), p);
        }, {}), save);
      } else save();
    });
  });
}

module.exports = function(argv, callback) {
  mongoose.connect(
    argv.dburl ||
    process.env.MONGOLAB_URI ||
    process.env.MONGOHQ_URL ||
    'mongodb://127.0.0.1/timon'
  );

  checkStale(function(err, count) {
    if (err) console.error("Error creating stale events:", err);
    else console.error(count+" stale event(s) registered.");
    main({
      dry: argv.dry,
      names: argv._.slice(1)
    }, callback);
  }, argv.dry);
};

module.exports.checkStale = checkStale;

odule.exports.help =
  "Usage: timon dispatch OPTIONS dispatchers...\n\n" +
  "Options: --dry, --dburl <mongodb url>";

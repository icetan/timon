var express = require('express'),
    mongoose = require('mongoose'),

    schema = require('./schema'),

    root, app, port;

function serve(opt) {
  app = express();

  app.use(express.bodyParser());
  app.use(express.methodOverride());
  // Add CORS headers
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  mongoose.connect(
    process.env.MONGOLAB_URI ||
    process.env.MONGOHQ_URL ||
    'mongodb://127.0.0.1/timon'
  );

  var Status = mongoose.model('status', schema.status),
      Event = mongoose.model('event', schema.event);

  function logChange(old, new_) {
    if (old.status !== new_.status) {
      Event.create({
        name: new_.name,
        update: new_.update,
        previousData: old.data,
        previousStatus: old.status,
        data: new_.data,
        status: new_.status,
        previous: old.updated
      }, function(err) {
        if (err) console.error("Error creating event:", err);
      });
    }
  }

  app.get('/status/?', function(req, res) {
    var query = {};
    if ('stale' in req.query) query = {
      updated: { $lt:Date.now() - schema.status.STALE_TIME }
    };
    Status.find(query, function(err, docs) {
      if (err) return res.send(500);
      res.json(docs);
    });
  });

  app.get('/status/:name', function(req, res) {
    Status.findOne({
      name: req.params.name,
    }, function(err, doc) {
      if (err) return res.send(500);
      if (!doc) return res.send(404);
      res.json(doc);
    });
  });

  app.put('/status/:name', function(req, res) {
    console.log("Receiving status from '"+
      ((fwdFor = req.headers['x-forwarded-for']) ?
        // For Heroku, which uses a proxy.
        fwdFor.split(',').slice(-1)[0].trim() :
        req.connection.remoteAddress)+
      "' with name '"+req.params.name+"'.");
    var data = req.body,
        new_ = {
          name: req.params.name,
          update: 0,
          data: data.data || {},
          status: data.status || 'unknown',
          updated: new Date()
        },
        fwdFor;
    Status.findOne({
      name: req.params.name,
    }, function(err, doc) {
      if (err) return res.send(500);
      var query = { _id:doc ? doc._id : new mongoose.Types.ObjectId };
      if (doc) new_.update = doc.update + 1;
      logChange(doc || {}, new_);
      Status.findOneAndUpdate(query, { $set:new_ }, { upsert:true },
        function(err, doc) {
          if (err) return (console.error(err), res.send(500));
          res.json(doc);
        });
    });
  });

  app.get('/event/?:name?', function(req, res) {
    var opt = {
        limit: Math.min(parseInt(req.query.limit || 100), 1000),
        sort: { $natural:-1 }
      },
      query = {};
    if (req.params.name) query.name = req.params.name;
    if (req.query.after) query.created = { $lt:req.query.after };
    Event.find(query, null, opt, function(err, docs) {
      if (err) return res.send(500);
      res.json(docs);
    });
  });

  app.listen(opt.port);
  console.log('Listening on http://127.0.0.1:'+opt.port);
}

module.exports = function(opt, callback) {
  serve({
    port: parseInt(opt.port) || process.env.PORT || 3000
  });
};

module.exports.help =
  "Usage: timon collect OPTIONS\n\n" +
  "Options: --port <port number>";

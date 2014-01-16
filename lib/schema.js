var mongoose = require('mongoose'),

    status = exports.status = new mongoose.Schema({
      name: {
        type: String,
        index: true
      },
      update: { type:Number, default:0 },
      data: {},
      status: String,
      created: { type:Date, default:Date.now },
      updated: { type:Date, default:Date.now }
    }),

    event = exports.event = new mongoose.Schema({
      name: String,
      update: Number,
      previousData: {},
      data: {},
      previousStatus: String,
      status: String,
      previous: Date,
      created: { type:Date, default:Date.now }
    }),

    check = exports.check = new mongoose.Schema({
      date: Date
    });

function clean(doc, ret) {
  delete ret._id;
  delete ret.__v;
}

status.STALE_TIME = 1000*60*10; // 10 minutes

status.virtual('stale').get(function() {
  return this.updated.getTime() < (Date.now() - status.STALE_TIME);
});

status.options.toJSON = {
  transform: function(doc, ret, options) {
    clean(doc, ret);
    ret.stale = doc.stale;
  }
};

event.options.toJSON = { transform:clean };

check.options.toJSON = { transform:clean };

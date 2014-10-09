var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restify = require('express-restify-mongoose');
var timestamps = require('mongoose-timestamp');
var _ = require('underscore');

function findOneOrCreate(schema) {
    schema.statics.findOneOrCreate = function findOneOrCreate(condition, doc) {
        var self = this;

        return self.findOne(condition).exec().then(function(result){
            return result ? result : self.create(doc);
        });
    };
}

module.exports = function(db){

    var numberMin0Type = { type: Number, min: 0};
    var articleLimit = new Schema({
        dec: numberMin0Type,
        limit: { type: Schema.Types.ObjectId, ref: 'Limit' }
    });

    var availableCurrencies = ['chf', 'eur'];
    var availableCurrenciesDefinition = {};
    _.each(availableCurrencies, function(currency){
       availableCurrenciesDefinition[currency] = numberMin0Type;
    });

    var schema = {
        setting: new Schema({
            name: String,
            desc: String,
            value: String,
            type: { type: String, enum: ['Printer']}
        }),
        articleLimit: articleLimit,
        article: new Schema({
            name: String,
            receipt: String,
            price: availableCurrenciesDefinition,
            limits: [articleLimit],
            kitchen: Boolean,
            active: Boolean,
            group: String
        }),
        order: new Schema({
            no: Number,
            sessionId: String,
            state: { type: String, enum: ['editing', 'preordered', 'sent']},
            name: String,
            currency: { type: String, enum: availableCurrencies},
            voucher: Boolean,
            items: [{
                count: numberMin0Type,
                article: { type: Schema.Types.ObjectId, ref: 'Article' }
            }],
            total: availableCurrenciesDefinition,
            kitchen: Boolean,
            kitchenNotes: String,
            printRequested: {
                kitchen: Boolean,
                receipt: Boolean
            }
        }, {toObject: { virtuals: true }, toJSON: { virtuals: true }}),
        limit: new Schema({
            name: String,
            available: numberMin0Type
        })
    };

    schema.order.plugin(timestamps);
    schema.order.virtual('open', { type: Boolean}).get(function(){
        return this.currency == undefined;
    });

    schema.setting.plugin(findOneOrCreate);

    var model = {
        setting: mongoose.model('Setting', schema.setting, 'settings'),
        article: mongoose.model('Article', schema.article, 'articles'),
        order: mongoose.model('Order', schema.order, 'orders'),
        limit: mongoose.model('Limit', schema.limit, 'limits')
    };

    schema.order.pre('save', function(next){
        var doc = this;
        var removeZeroOrderItems = function(){
            _.each(doc.items, function(item){
                if (item && item.count == 0){
                    item.remove();
                }
            });
        };
        var updateTotalAndKitchen = function(){
            doc.populate({ path: 'items.article', select: 'price kitchen'}, function(err, order){
                if (err) throw err;
                doc.total.chf = 0;
                doc.total.eur = 0;
                doc.kitchen = false;
                _.each(order.items, function(item){
                    doc.total.chf += item.article.price.chf * item.count;
                    doc.total.eur += item.article.price.eur * item.count;
                    doc.kitchen |= item.article.kitchen;
                });
                next();
            });
        };
        if (doc.isNew){
            model.order.count(function(err, count){
                if (err) throw err;
                doc.no = count + 1;
                removeZeroOrderItems();
                updateTotalAndKitchen();
            });
        } else {
            removeZeroOrderItems();
            updateTotalAndKitchen();
        }
    });

    schema.article.pre('save', function(next){
        // remove limits with a dec < 1
       var doc = this;
        _.each(doc.limits, function(articleLimit){
            if (articleLimit && articleLimit.dec < 1){
                articleLimit.remove();
            }
        });
        next();
    });

    mongoose.connect(db);
    // CONNECTION EVENTS
    // When successfully connected
    mongoose.connection.on('connected', function () {
        console.log('Mongoose default connection open to ' + db);
    });

    // If the connection throws an error
    mongoose.connection.on('error',function (err) {
        console.log('Mongoose default connection error: ' + err);
    });

    // When the connection is disconnected
    mongoose.connection.on('disconnected', function () {
        console.log('Mongoose default connection disconnected');
    });

    // If the Node process ends, close the Mongoose connection
    process.on('SIGINT', function() {
        mongoose.connection.close(function () {
            console.log('Mongoose default connection disconnected through app termination');
            process.exit(0);
        });
    });

    return {
        addRestRoutes: function(app){
            restify.serve(app, model.setting);

            restify.serve(app, model.article, {
                prereq: function(req) {
                    _.each(req.body.limits, function(articleLimit){
                       if (articleLimit.limit._id) {
                           articleLimit.limit = articleLimit.limit._id;
                       }
                    });
                    return true;
                },
                findOneAndUpdate: false // necessary for calling hooks like pre-save
            });

            restify.serve(app, model.order, {
                prereq: function(req){
                  return req.method === 'GET' || req.method === 'DELETE';
                },
                lean: false, // otherwise, virtuals are not included
                findOneAndUpdate: false // necessary for calling hooks like pre-save
            });

            restify.serve(app, model.limit);
        },
        model: model,
        availableCurrencies: availableCurrencies
    }
};

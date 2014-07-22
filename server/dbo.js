var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restify = require('express-restify-mongoose');

module.exports = function(db){

    var schema = {
        setting: new Schema({
            receiptPrinter: String,
            orderPrinter: String
        }),
        article: new Schema({
            name: String,
            receipt: String,
            price: {
                chf: Number,
                eur: Number
            },
            limits: [{
                dec: Number,
                limit: { type: Schema.Types.ObjectId, ref: 'Limit' }
            }],
            kitchen: Boolean,
            active: Boolean,
            group: String
        }),
        order: new Schema({
            no: Number,
            currency: String,
            articles: [{
                count: Number,
                article: { type: Schema.Types.ObjectId, ref: 'Article' }
            }],
            total: Number,
            kitchen: Boolean
        }),
        limit: new Schema({
            name: String,
            available: Number
        })
    };


    var model = {
        setting: mongoose.model('Setting', schema.setting, 'settings'),
        article: mongoose.model('Article', schema.article, 'articles'),
        order: mongoose.model('Order', schema.order, 'orders'),
        limit: mongoose.model('Limit', schema.limit, 'limits')
    };

    schema.order.pre('save', function(next){
        var doc = this;
        if (doc.isNew){
            model.order.count(function(err, count){
                if (err) throw err;
                doc.no = count + 1;
                next();
            });
        }
    });
    schema.order.post('init', function(next){
       var doc = this;
       doc.populate({ path: 'articles.article', select: 'price'}, function(err){
           if (err) throw err;
       })
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
            restify.serve(app, model.article);
            restify.serve(app, model.order);
            restify.serve(app, model.limit);
        }
    }
};

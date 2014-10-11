var fs = require('fs');
var childProcess = require('child_process');
var moment = require('moment');
var Q = require('q');
var shellescape = require('shell-escape');
var PDFDocument = require('pdfkit');
var _ = require('underscore');
var mongoosePromiseHelper = require('./wrapMPromise')
var wrapMpromise = mongoosePromiseHelper.wrapMpromise;
var wrapMongooseCallback = mongoosePromiseHelper.wrapMongooseCallback;


function printFile(printer, jobname, file, options) {
    var deferred = Q.defer();
    var args = [];
    args.push('lp');
    args.push('-d');
    args.push(printer);
    args.push('-t'); // job name
    args.push(jobname);
    if (options) {
        args.push(options);
    }
    args.push(file);
    childProcess.exec(shellescape(args), function(error, stdout, stderr){
        if (error != null) {
            var errorMsg = 'Fehler beim Drucken auf ' + printer + ': ' + stderr;
            deferred.reject(new Error(errorMsg));
        } else {
            deferred.resolve(stdout);
        }
    });
    return deferred.promise;
}

function createJobname(order, suffix) {
    var orderId = moment(order._id.getTimestamp()).format('YYYYMMDD-HHmmss');
    if (order.no)
        orderId += '-' + order.no;
    var jobname = orderId + '-' + suffix;
    return jobname;
}

function getPrinters() {
    var deferred = Q.defer();
    childProcess.exec('lpstat -a | cut -d " " -f 1', function(error, stdout, stderr) {
        if (error != null) {
            deferred.reject(error);
        } else {
            var printers = stdout.split(/\n/);
            printers.pop(); // remove the last (empty) item
            deferred.resolve(printers);
        }
    });
    return deferred.promise;
}

function removeJobFromQueue(jobId) {
    var deferred = Q.defer();
    childProcess.exec(shellescape(['cancel',jobId]), function(error, stdout, stderr) {
        if (error != null) {
            deferred.reject(error);
        } else {
            deferred.resolve(stdout);
        }
    });
    return deferred.promise;

}

function getCompletedJobIds() {
    var deferred = Q.defer();
    childProcess.exec('lpstat -W completed', function(error, stdout, stderr){
        if (error != null) {
            deferred.reject(error);
        } else {
            var queue = stdout.split('\n');
            queue.pop(); // remove last
            deferred.resolve(_.map(queue, function(line){
                return line.match(/[^ ]+/)[0].match(/\d+$/)[0];
            }));
        }
    });
    return deferred.promise;
}

function cm2pdfUnit(cm) {
    var inch = cm / 2.54;
    return inch * 72;
}

function drawBoxedText(doc, text){
    var y = doc.y;
    var textWidth = doc.widthOfString(text);
    var contentWidth = doc.page.width;
    doc.text(text, {align: 'center'});

    doc
        .lineWidth(1)
        .roundedRect((contentWidth - textWidth)/2 - 5, y - 6, textWidth + 10, doc.y - y + 5, 5)
        .stroke();
    return doc;
}
function currency(amount) {
    return (amount/100).toFixed(2);
}

function writePdf(doc, pdfFileName){
    var deferred = Q.defer();
    var writer = fs.createWriteStream(pdfFileName);
    writer.on('finish', function(){
        deferred.resolve(pdfFileName);
    });
    writer.on('error', function(err){
       deferred.reject(err);
    });
    doc.pipe(writer);
    doc.end();
    return deferred.promise;
}
module.exports = function(settings) {

    var dataService = settings.dataService;
    var pdfDirectory = settings.pdfDirectory || 'pdfs';
    var receiptPrinterSettingName = 'receiptPrinter';
    var kitchenPrinterSettingName =  'kitchenPrinter';
    var interval = settings.interval || 1000;

    var createReceiptPdf = function(order) {
        var doc = new PDFDocument({
            size: [cm2pdfUnit(8),cm2pdfUnit(29)],
            margin: cm2pdfUnit(0.5)
        });
        doc.font('Helvetica').fontSize(12).text('Bistro-Bestellung', {align:'center'}).moveDown();
        doc.font('Helvetica-Bold').fontSize(16);

        drawBoxedText(doc, 'Nr. ' + order.no).moveDown(0.5);
        doc.font('Helvetica').fontSize(10).text('vom ' + moment(order._id.getTimestamp()).format('HH:mm DD.MM.YYYY'), {align: 'center'}).moveDown(2);

        doc.font('Helvetica').fontSize(10);
        var textColWith = cm2pdfUnit(4.5);
        var colSpace = cm2pdfUnit(0.1);
        _.each(order.items, function(item){
            if (item.count == 1) {
                doc.text(item.article.receipt || item.article.name, {width: cm2pdfUnit(5.5)}).moveUp();
                doc.text(currency(item.article.price[order.currency]), {align: 'right'});
            } else {
                var text = item.count + 'x ' + currency(item.article.price[order.currency]);
                text += '   ' + currency(item.article.price[order.currency]* item.count);
                doc.text(text, {align: 'right'}).moveUp();
                doc.text(item.article.receipt || item.article.name, {width: cm2pdfUnit(4.5), lineGap: 1});
            }
            doc.moveDown(0.5);
        });
        doc.font('Helvetica-Bold').text('Total').moveUp();
        doc.text(order.currency.toUpperCase() + ' ' + currency(order.total[order.currency]), {align: 'right'});

        if (order.kitchenNotes){
            doc.moveDown().text('Hinweise an die Küche:').moveDown(0.5);
            doc.font('Helvetica');
            _.each(order.kitchenNotes.split('\n'), function(line){
                doc.text(line, {indent: doc.page.margins.left});
            });
        }

        var pdfFileName = pdfDirectory + '/receipt_' + order.no + '.pdf';
        return writePdf(doc, pdfFileName);

    };

    var createKitchenPdf = function (order) {
        var doc = new PDFDocument({size: 'A4'});
        doc.font('Helvetica').fontSize(28).text('Bestellung Nummer ' + order.no);
        doc.fontSize(12);
        doc.text('Bestellung aufgegeben um ' + moment(order._id.getTimestamp()).format('HH:mm [am] DD.MM.YYYY'))
            .moveDown(2);

        if (order.kitchenNotes){
            doc.fontSize(18);
            var y = doc.y - 10;
            _.each(order.kitchenNotes.split('\n'), function(line){
               doc.text('   ' + line, {width: 400});
            });
            doc
                .lineWidth(1)
                .roundedRect(doc.x, y, 410, doc.y - y + 5, 5)
                .stroke()
            doc.moveDown(1.5);
        }

        doc.fontSize(22);
        _.each(order.items, function (item) {
            if (item.article.kitchen) {
                doc.text(item.count + 'x')
                    .moveUp()
                    .text(item.article.name, {indent: 40, lineGap: 10});
            }
        });

        var pdfFileName = pdfDirectory + '/order_' + order.no + '.pdf';
        return writePdf(doc, pdfFileName);
    };

    var printerConfig = {
        kitchen: {
            pdfFunc: createKitchenPdf,
            printOptions: '-o media=a5 -o fit-to-page'
        },
        receipt: {
            pdfFunc: createReceiptPdf,
            printOptions: ''

        }
    };

    var setPrintJobComment = function(printJob, comment) {
        printJob.comment = comment;
        return wrapMongooseCallback(printJob, printJob.save);
    };

    var handlePrintRequest = function(printJob, printerNames){
        if (!printerNames[printJob.type]) {
            return setPrintJobComment(printJob, 'Kein Drucker definiert für ' + printJob.type);
        }
        var config = printerConfig[printJob.type];
        if (config) {
            var order = printJob.order;
            var printerName = printerNames[printJob.type];
            return config.pdfFunc(order)
                .then(function(pdfFileName){
                    printJob.file = pdfFileName;
                    return printFile(printerName, createJobname(order, printJob.type), pdfFileName, config.printOptions);
                })
                .then(function(jobId){
                    printJob.jobId = jobId.match(RegExp(printerName + '[^ ]+'))[0].match(/\d+$/)[0];
                    return setPrintJobComment(printJob,'Auftrag an Drucker gesandt');
                });
        } else {
            return setPrintJobComment(printJob, 'Unbekannter Druck-Typ ' + printJob.type);
        }
    };

    var findOrCreatePrinterSetting = function(settingName, desc, value){
        return wrapMpromise(
            dataService.model.setting
                .findOneOrCreate({name: settingName}, {name: settingName, desc: desc, value: value, type: 'Printer'})
        );
    };

    var fetchPrinterNames = function() {
        printerNames = {};
        availablePrinters = [];
        return getPrinters()
            .then(function(data){
                availablePrinters = data;
                return findOrCreatePrinterSetting(kitchenPrinterSettingName, 'Küchendrucker', availablePrinters[0]);
            })
            .then(function(setting){
                printerNames.kitchen = setting.value;
                return findOrCreatePrinterSetting(receiptPrinterSettingName, 'Bondrucker', availablePrinters[1]);
            })
            .then(function(setting){
                printerNames.receipt = setting.value;
                return printerNames;
            });
    };

    var checkForNewPrintRequest = function(){
        var printerNames = {};
        return fetchPrinterNames()
            .then(function(data){
                printerNames = data;
                return wrapMpromise(
                    dataService.model.printJob.where('jobId').exists(false)
                        .populate('order')
                        .exec()
                );
            })
            .then(function(printJobs){
                return wrapMongooseCallback(
                    dataService.model.printJob,
                    dataService.model.printJob.populate,
                    printJobs, {path: 'order.items.article', model: 'Article'}
                );
            })
            .then(function(printJobs){
                return Q.all(
                    _.map(printJobs, function(printJob){
                        return handlePrintRequest(printJob, printerNames);
                    })
                );
            });
    };

    var cleanupPendingState = function() {
        return getCompletedJobIds()
            .then(function(jobIds){
                return wrapMpromise(dataService.model.printJob.update(
                    { $and: [{jobId: { $in: jobIds}}, {pending: true}] }, { pending: false, comment: 'Auftrag abgeschlossen'}, {multi: true})
                    .exec()
                );
            });
    };

    if (!fs.existsSync(pdfDirectory)) {
        fs.mkdirSync(pdfDirectory);
    }

    if (!settings.disablePrinting) {
        setInterval(function() {
            checkForNewPrintRequest()
                .then(cleanupPendingState)
                .catch(function(error){
                    console.log(error.stack);
                })
                .done();
        }, interval);
    }

    var cancelJob = function(id){
        return wrapMpromise(dataService.model.printJob.findOneAndRemove({_id: id}).exec())
            .then(function(printJob){
                if (printJob && printJob.jobId && printJob.pending){
                   return removeJobFromQueue(printJob.jobId);
                }
            });
    };


    return {
        getPrinters: getPrinters,
        cancelJob: cancelJob
    };

};

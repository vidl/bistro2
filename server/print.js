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
            console.log(errorMsg);
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
                return line.match(/\w+-\d+/)[0];
            }));
        }
    });
    return deferred.promise;
}

module.exports = function(settings) {

    var dataService = settings.dataService;
    var pdfDirectory = settings.pdfDirectory || 'pdfs';
    var receiptPrinterSettingName = 'receiptPrinter';
    var kitchenPrinterSettingName =  'kitchenPrinter';
    var interval = settings.interval || 1000;


    var createKitchenPdf = function (order) {
        var doc = new PDFDocument();
        doc.font('Helvetica').fontSize(28).text('Bestellung Nummer ' + order.no).moveDown();
        doc.fontSize(18);
        _.each(order.items, function (item) {
            doc.text(item.count + 'x ' + item.article.name).moveDown();
        });
        var pdfFileName = pdfDirectory + '/order_' + order.no + '.pdf';
        doc.pipe(fs.createWriteStream(pdfFileName));
        doc.end();
        return pdfFileName;
    };

    var setPrintJobComment = function(printJob, comment) {
        printJob.comment = comment;
        return wrapMongooseCallback(printJob, printJob.save);
    };

    var handlePrintRequest = function(printJob, printerNames){
        if (!printerNames[printJob.type]) {
            return setPrintJobComment(printJob, 'Kein Drucker definiert für ' + printJob.type);
        }
        if (printJob.type === 'kitchen') {
            var order = printJob.order;
            var pdfName = createKitchenPdf(order);
            return printFile(printerNames[printJob.type], createJobname(order, printJob.type), pdfName, '-o media=a5 -o fit-to-page')
                .then(function(jobId){
                    printJob.file = pdfName;
                    printJob.jobId = jobId.match(/\w+-\d+/);
                    return setPrintJobComment(printJob,'Auftrag an Durcker gesandt');
                });
        } else if (printJob.type === 'receipt') {
            // todo print on receipt printer
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
                        .populate('order order.items.article')
                        .exec()
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

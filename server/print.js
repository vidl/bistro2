var fs = require('fs');
var childProcess = require('child_process');
var moment = require('moment');
var Q = require('q');
var shellescape = require('shell-escape');
var PDFDocument = require('pdfkit');
var _ = require('underscore');
var wrapMpromise = require('./wrapMPromise')


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

function getQueue() {
    var deferred = Q.defer();
    childProcess.exec('lpq -a', function(error, stdout, stderr){
        if (error != null) {
            deferred.reject(error);
        } else {
            var queue = stdout.split('\n');
            queue.shift(); // removes the first element (header)
            queue.pop(); // remove the last (empty) element
            deferred.resolve(queue);
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

    var handlePrintRequest = function(order, printerNames){
        if (order.printRequested.kitchen) {
            var pdfName = createKitchenPdf(order);
            console.log('Print order ' + order.no + ' on ' + printerNames.kitchen);
            printFile(printerNames.kitchen, createJobname(order, 'kitchen'), pdfName, '-o media=a5 -o fit-to-page')
                .then(function(){
                    order.printRequested.kitchen = false;
                    order.save();
                });
        }
        // todo print on receipt printer
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
        fetchPrinterNames()
            .then(function(data){
                printerNames = data;
                return wrapMpromise(
                    dataService.model.order.find()
                    .or({'printRequested.kitchen': true},{ 'printRequested.receipt': true})
                    .populate('items.article').exec()
                );
            })
            .then(function(orders){
                _.each(orders, function(order){
                    handlePrintRequest(order, printerNames);
                });
            })
            .catch(function(error){
                console.log(error.stack);
            })
            .done();
    };

    if (!fs.existsSync(pdfDirectory)) {
        fs.mkdirSync(pdfDirectory);
    }

    if (!settings.disablePrinting) {
        setInterval(checkForNewPrintRequest, interval);
    }




    return {
        getQueue: getQueue,
        getPrinters: getPrinters
    };

};

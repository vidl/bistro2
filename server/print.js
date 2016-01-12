var childProcess = require('child_process');
var Q = require('q');
var shellescape = require('shell-escape');
var _ = require('underscore');
var mongoosePromiseHelper = require('./wrapMPromise')
var wrapMpromise = mongoosePromiseHelper.wrapMpromise;
var wrapMongooseCallback = mongoosePromiseHelper.wrapMongooseCallback;


function printFile(printer, file, options) {
    var deferred = Q.defer();
    var args = [];
    args.push('lp');
    args.push('-d');
    args.push(printer);
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
            queue.pop(); // remove the last (empty) item
            deferred.resolve(_.map(queue, function(line){
                return line.match(/[^ ]+/)[0].match(/\d+$/)[0];
            }));
        }
    });
    return deferred.promise;
}

module.exports = function(settings) {

    var dataService = settings.dataService;
    var receiptPrinterSettingName = 'receiptPrinter';
    var kitchenPrinterSettingName =  'kitchenPrinter';
    var kitchenPrinterTypeSettingName = 'kitchenPrinterType';
    var kitchenPrinterTypes = [
        { name: 'Bondrucker', type: 'receipt'},
        { name: 'normaler Drucker', type: 'normal'}
    ];
    var interval = settings.interval || 1000;


    var printerConfig = {
        kitchen: '-o media=a5 -o fit-to-page'
    };

    var setPrintJobComment = function(printJob, comment) {
        printJob.comment = comment;
        return wrapMongooseCallback(printJob, printJob.save);
    };

    var handlePrintRequest = function(printJob, printerNames){
        var printerName = printerNames[printJob.type];
        if (!printerName) {
            return setPrintJobComment(printJob, 'Kein Drucker definiert für ' + printJob.type);
        }
        var config = printerConfig[printJob.type];
        return printFile(printerName, printJob.file, config)
            .then(function(jobId){
                printJob.jobId = jobId.match(RegExp(printerName + '[^ ]+'))[0].match(/\d+$/)[0];
                return setPrintJobComment(printJob,'Auftrag an Drucker gesendet');
            });
    };

    var findOrCreatePrinterSetting = function(settingName, desc, value){
        return wrapMpromise(
            dataService.model.setting
                .findOneOrCreate({name: settingName}, {name: settingName, desc: desc, value: value, type: 'Printer'})
        );
    };

    var findOrCreateKitchenPrinterTypeSetting = function(settingName, desc, value){
        return wrapMpromise(
            dataService.model.setting
                .findOneOrCreate({name: settingName}, {name: settingName, desc: desc, value: value, type: 'KitchenPrinterType'})
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

    var fetchKitchenPrinterType = function() {
        return findOrCreateKitchenPrinterTypeSetting(kitchenPrinterTypeSettingName, 'Küchendrucker-Typ', kitchenPrinterTypes[0].type)
            .then(function(setting){
                return setting.value;
            });
    };

    var checkForNewPrintRequest = function(){
        var printerNames = {};
        return fetchPrinterNames()
            .then(function(data){
                printerNames = data;
                return wrapMpromise(dataService.model.printJob.where('jobId').exists(false).exec());
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

    fetchKitchenPrinterType();

    return {
        getPrinters: getPrinters,
        cancelJob: cancelJob,
        kitchenPrinterTypes: kitchenPrinterTypes,
        getKitchenPrinterType: fetchKitchenPrinterType
    };

};

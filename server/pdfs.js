var fs = require('fs');
var moment = require('moment');
var Q = require('q');
var PDFDocument = require('pdfkit');
var _ = require('underscore');


function cm2pdfUnit(cm) {
    var inch = cm / 2.54;
    return inch * 72;
}

function drawBoxedText(doc, text){
    var y = doc.y;
    var textWidth = doc.widthOfString(text);
    var contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.text(text, {align: 'center'});

    doc
        .lineWidth(1)
        .roundedRect(doc.page.margins.left + (contentWidth - textWidth)/2 - 5, y - 6, textWidth + 10, doc.y - y + 5, 5)
        .stroke();
    return doc;
}
function formatAmount(amount, currency) {
    var value = (amount / 100).toFixed(2);
    if (currency) {
        value += ' ' + currency.toUpperCase();
    }
    return  value;
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
module.exports = function(settings){
    var pdfDirectory = settings.pdfDirectory || 'pdfs';

    var createReceiptPdf = function(order) {
        var doc = new PDFDocument({
            size: [cm2pdfUnit(8),cm2pdfUnit(29)],
            margins: {
                left: cm2pdfUnit(0.5),
                right: cm2pdfUnit(0.9),
                top: cm2pdfUnit(0.5),
                bottom: cm2pdfUnit(0.5)
            }
        });
        doc.font('Helvetica').fontSize(12).text('Bistro-Bestellung', {align:'center'}).moveDown();
        doc.font('Helvetica-Bold').fontSize(16);

        if (order.no) {
            drawBoxedText(doc, 'Nr. ' + order.no).moveDown(0.5);
        }

        doc.font('Helvetica').fontSize(8);
        _.each(order.items, function(item){
            if (item.count == 1) {
                doc.text(item.article.receipt || item.article.name, {width: cm2pdfUnit(5.5)}).moveUp();
                doc.text(formatAmount(item.article.price[order.currency]), {align: 'right'});
            } else {
                var text = item.count + 'x ' + formatAmount(item.article.price[order.currency]);
                text += '   ' + formatAmount(item.article.price[order.currency]* item.count);
                doc.text(text, {align: 'right'}).moveUp();
                doc.text(item.article.receipt || item.article.name, {width: cm2pdfUnit(4.5), lineGap: 1});
            }
            doc.moveDown(0.5);
        });
        doc.font('Helvetica-Bold').fontSize(10).text('Total').moveUp();
        doc.text(order.currency.toUpperCase() + ' ' + formatAmount(order.total[order.currency]), {align: 'right'});

        if (order.kitchenNotes){
            doc.moveDown().text('Hinweise an die Küche:').moveDown(0.5);
            doc.font('Helvetica');
            _.each(order.kitchenNotes.split('\n'), function(line){
                doc.text(line);
            });
        }

        doc.moveDown(2);
        doc.font('Helvetica').fontSize(8).text(moment(order._id.getTimestamp()).format('HH:mm DD.MM.YYYY'), {align: 'center'}).moveDown(2);

        var ts = moment(order._id.getTimestamp()).format('YYYYDDMM-HHmmss');
        var pdfFileName = pdfDirectory + '/receipt_' + (order.no || ts) + '.pdf';
        return writePdf(doc, pdfFileName);

    };

    var createKitchenReceiptPdf = function (order) {
        var doc = new PDFDocument({
            size: [cm2pdfUnit(8),cm2pdfUnit(29)],
            margins: {
                left: cm2pdfUnit(0.5),
                right: cm2pdfUnit(0.9),
                top: cm2pdfUnit(0.5),
                bottom: cm2pdfUnit(0.5)
            }
        });
        doc.font('Helvetica').fontSize(12).text('Bistro-Bestellung', {align:'center'}).moveDown();
        doc.font('Helvetica-Bold').fontSize(16);

        drawBoxedText(doc, 'Nr. ' + order.no).moveDown(0.5);

        doc.font('Helvetica');
        if (order.kitchenNotes){
            doc.fontSize(12);
            var y = doc.y;
            _.each(order.kitchenNotes.split('\n'), function(line){
                doc.text(line, {width: 200});
            });
            doc
                .lineWidth(1)
                .roundedRect(doc.x - 5, y - 5, 205, doc.y - y + 5, 5)
                .stroke()
            doc.moveDown(1);
        }
        doc.fontSize(12);
        _.each(order.items, function (item) {
            if (item.article.kitchen) {
                doc.text(item.count + 'x')
                    .moveUp()
                    .text(item.article.name, {indent: 20, lineGap: 10});
            }
        });

        doc.moveDown(1);
        doc.font('Helvetica').fontSize(8).text(moment(order._id.getTimestamp()).format('HH:mm DD.MM.YYYY'), {align: 'center'}).moveDown(2);

        var pdfFileName = pdfDirectory + '/order_' + order.no + '.pdf';
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

    var createBalanceAndStatisticsPdf = function(balanceAndStatistics) {
        var dateRange = function(format, delimiter) {
            var from = balanceAndStatistics.orderDateRange.from.format(format);
            var to = balanceAndStatistics.orderDateRange.to.format(format);
            return from === to ? from : from + delimiter + to;
        };
        var doc = new PDFDocument({size: 'A4'});
        doc.font('Helvetica').fontSize(18).text('Kassenabschluss und Statistiken Bistro')
            .fontSize(12).text('Basierend auf Bestellungen vom ' + dateRange('DD.MM.YYYY', ' - ')
        ).moveDown();

        doc.fontSize(16).text('Umsatz').moveDown(0.3);
        doc.fontSize(12).text('Einnahmen: ' + _.map(balanceAndStatistics.balance.revenues, formatAmount).join(', ')).moveDown(0.3);
        doc.fontSize(12).text('Gutscheine: ' + _.map(balanceAndStatistics.balance.vouchers, formatAmount).join(', ')).moveDown(0.3);

        doc.moveDown();
        doc.fontSize(16).text('Verbrauchte limitierte Zutaten').moveDown(0.3);
        doc.fontSize(12);
        _.each(balanceAndStatistics.limits, function(limit){
           doc.text(limit.name + ': ' + limit.used + ' von ' + limit.total).moveDown(0.3);
        });

        doc.moveDown();
        doc.fontSize(16).text('Verkaufte Artikel').moveDown(0.3);
        doc.fontSize(12);
        _.each(balanceAndStatistics.articles, function(article){
            doc.text(article.count + 'x ' + article.name).moveDown(0.3);
        });
        doc.moveDown();
        doc.text(balanceAndStatistics.orderCount + ' Bestellungen');

        var pdfFileName = pdfDirectory + '/balanceAndStatistics' + dateRange('DD_MM_YYYY', '-') + '.pdf';
        return writePdf(doc, pdfFileName);
    };

    var removeAllPdfs = function() {
        return Q.nfapply(fs.readdir, [pdfDirectory])
            .then(function(files){
                var pdfFiles = _.filter(files, function(file){
                   return file.indexOf('.pdf',file.length - '.pdf'.length) !== -1;
                });
                return Q.all(_.map(pdfFiles, function(file){
                    return Q.nfapply(fs.unlink, [pdfDirectory + '/' + file]);
                }));
            });
    };

    if (!fs.existsSync(pdfDirectory)) {
        fs.mkdirSync(pdfDirectory);
    }

    return {
        kitchennormal: createKitchenPdf,
        kitchenreceipt: createKitchenReceiptPdf,
        receipt: createReceiptPdf,
        balanceAndStatistics: createBalanceAndStatisticsPdf,
        removeAllPdfs: removeAllPdfs
    };
};
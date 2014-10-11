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

        drawBoxedText(doc, 'Nr. ' + order.no).moveDown(0.5);

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

    var createBalanceAndStatisticsPdf = function(balanceAndStatistics) {
        var doc = new PDFDocument({size: 'A4'});
        doc.font('Helvetica').fontSize(24).text('Umsatz vom Bistro des ' +  moment().format('DD.MM.YYYY'));

        doc.fontSize(12).text('Einnahmen: ' + _.map(balanceAndStatistics.balance.revenues, formatAmount).join(', ')).moveDown();
        doc.fontSize(12).text('Gutscheine: ' + _.map(balanceAndStatistics.balance.vouchers, formatAmount).join(', ')).moveDown();

        var pdfFileName = pdfDirectory + '/balanceAndStatistics' + moment().format('DD_MM_YYYY') + '.pdf';
        return writePdf(doc, pdfFileName);
    };

    if (!fs.existsSync(pdfDirectory)) {
        fs.mkdirSync(pdfDirectory);
    }

    return {
        kitchen: createKitchenPdf,
        receipt: createReceiptPdf,
        balanceAndStatistics: createBalanceAndStatisticsPdf
    };
};
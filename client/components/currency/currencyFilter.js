angular.module('bistro.currency.filter',[]).filter('currency', function() {
    return function(amount, symbol) {
        if (typeof amount == 'string') {
            return parseFloat(amount) * 100;
        }

        var addSymbol = function(val) {
            if (symbol)
                val += ' ' + symbol.toUpperCase();
            return val;
        };

        if (isNaN(amount)) {
            return addSymbol('--');
        }

        if (typeof amount == 'number'){
            return addSymbol((amount / 100).toFixed(2));
        }

        return amount;
    };
});

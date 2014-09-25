angular.module('bistro.currency.directive',['bistro.currency.filter']).directive('currency', ['$filter', function($filter){
        // inspired by http://docs.angularjs.org/guide/forms
        // var FLOAT_REGEXP = /^\-?\d+((\.|\,)\d+)?$/;
        var POSITIVE_FLOAT_REGEXP = /^\d+((\.|\,)\d*)?$/;
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function(scope, elmement, attrs, ctrl) {
                var currency = $filter('bistroCurrency');
                ctrl.$render = function() {
                    elmement.val(currency(ctrl.$modelValue));
                };

                ctrl.$parsers.unshift(function(viewValue) {
                    if (viewValue === '.') {
                        viewValue = '0.';
                        elmement.val(viewValue);
                    }
                    if (POSITIVE_FLOAT_REGEXP.test(viewValue)) {
                        ctrl.$setValidity('float', true);
                        return currency(viewValue.replace(',', '.'));
                    } else {
                        ctrl.$setValidity('float', false);
                        return undefined;
                    }
                });
            }
        };
}]);

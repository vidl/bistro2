'use strict';

angular.module('bistro.cashbox', ['ngRoute'])

    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider.when('/cashbox', {
            templateUrl: 'cashbox/cashbox.html',
            controller: 'CashboxCtrl'
        });
    }])

    .controller('CashboxCtrl', [function () {

    }]);
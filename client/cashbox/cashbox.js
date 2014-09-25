'use strict';

angular.module('bistro.cashbox', ['ui.router'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider.state('cashbox', {
            url: '/cashbox',
            templateUrl: 'cashbox/cashbox.html',
            controller: 'CashboxCtrl'
        });

    }])

    .controller('CashboxCtrl', [function () {

    }]);
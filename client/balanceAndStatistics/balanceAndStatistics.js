'use strict';

angular.module('bistro.balanceAndStatistics', ['ui.router', 'bistro.currency'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('balanceAndStatistics',{
                url: '/balanceAndStatistics',
                templateUrl: 'balanceAndStatistics/balanceAndStatistics.html',
                controller: 'balanceAndStatisticsCtrl'
            });


    }])
    .controller('balanceAndStatisticsCtrl', ['$scope', '$http', 'availableCurrencies', function($scope, $http, availableCurrencies){
        $scope.availableCurrencies = availableCurrencies;
        $scope.revenues = [];
        $scope.vouchers = [];
        $http.get('/balanceAndStatistics').success(function(data){
            $scope.revenues = _.map(availableCurrencies, function(currency){
                return {currency: currency, amount: data.balance.revenues[currency]};
            });
            $scope.vouchers = _.map(availableCurrencies, function(currency){
                return {currency: currency, amount: data.balance.vouchers[currency]};
            });
            $scope.balanceAndStatistics = data;
        });
        $scope.print = function(){
            $http.post('/balanceAndStatistics/print');
        };
    }]);

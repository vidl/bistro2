'use strict';

angular.module('bistro.balanceAndStatistics', ['ui.router', 'bistro.currency', 'bistro.date'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('balanceAndStatistics',{
                url: '/balanceAndStatistics',
                templateUrl: 'balanceAndStatistics/balanceAndStatistics.html',
                controller: 'balanceAndStatisticsCtrl'
            });


    }])
    .controller('balanceAndStatisticsCtrl', ['$scope', '$http', 'availableCurrencies', '$filter', function($scope, $http, availableCurrencies, $filter){
        $scope.availableCurrencies = availableCurrencies;
        var init = function() {
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
                var from = $filter('bistroDate')(data.orderDateRange.from);
                var to = $filter('bistroDate')(data.orderDateRange.to);
                $scope.orderDateRange = from === to ? from : from + ' - ' + to;
            });
        };
        init();
        $scope.print = function(){
            $http.post('/balanceAndStatistics/print');
        };
        $scope.startOver = function(){
            $http.post('/balanceAndStatistics/startOver').success(init);
        };
    }]);

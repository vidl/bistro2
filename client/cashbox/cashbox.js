'use strict';

angular.module('bistro.cashbox', ['ui.router', 'bistro.articles'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider.state('cashbox', {
            url: '/cashbox',
            templateUrl: 'cashbox/cashbox.html',
            controller: 'CashboxCtrl'
        });

    }])
    .value('voucherCurrency', 'chf')

    .controller('CashboxCtrl', ['$scope', 'Article', '$http', 'availableCurrencies', function ($scope, Article, $http, availableCurrencies) {
        $scope.articles = Article.query();
        $scope.showKitchenNotes = false;
        $scope.availability = {};
        $scope.order = {};

        $http.get('/availability').success(function(data){
            $scope.availability = data;
        });

        $scope.available = function(article){
            var available = _.map(article.limits, function(limit){
                var availableByLimit = $scope.availability[limit.limit] || { used: 0, total: 0};
                return Math.floor((availableByLimit.total - availableByLimit.used) / limit.dec);
            });
            return available.length ? _.min(available) : undefined;
        };

        var newOrderReceived = function(data){
            $scope.order = data;
            $scope.showKitchenNotes = false;
        };

        $http.get('/order').success(newOrderReceived);

        $scope.inc = function(article, incAmount) {
            $http.put('/order', {article: article._id, incAmount:incAmount}).success(function(data){
                $scope.order = data.order;
                $scope.availability = data.limits;
            });
        };


        $scope.commit = function(currency) {
            $http.post('/order', {currency: currency}).success(newOrderReceived);
        };

        $scope.voucher = function() {
            $http.post('/order', {voucher: true}).success(newOrderReceived);
        };
    }]);
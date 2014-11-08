'use strict';

angular.module('bistro.cashbox', ['ui.router', 'bistro.articles', 'bistro.tags'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider.state('cashbox', {
            url: '/cashbox',
            templateUrl: 'cashbox/cashbox.html',
            controller: 'CashboxCtrl'
        });

    }])
    .value('voucherCurrency', 'chf')

    .controller('CashboxCtrl', ['$scope', 'Article', '$http', 'availableCurrencies', 'tags', function ($scope, Article, $http, availableCurrencies, tags) {

        Article.query({populate: 'limits.limit', sort:'name'}, function(articles){
            tags.setFromArticles(articles);
            $scope.tags = tags.getAvailableTags();
            $scope.articles = articles;
        });

        $scope.availableCurrencies = availableCurrencies;
        $scope.isSelected = tags.isSelected;
        $scope.select = tags.select;
        $scope.selectSingle = tags.selectSingle;

        $scope.showKitchenNotes = false;
        $scope.kitchenNotes = '';
        $scope.availability = {};
        $scope.order = {};

        $http.get('/availability').success(function(data){
            $scope.availability = data;
        });

        $scope.available = function(article){
            var available = _.map(article.limits, function(limit){
                var availableByLimit = $scope.availability[limit.limit._id] || { used: 0, total: 0};
                return Math.floor((availableByLimit.total - availableByLimit.used) / limit.dec);
            });
            return available.length ? _.min(available) : undefined;
        };

        var newOrderReceived = function(data){
            $scope.order = data;
            $scope.kitchenNotes = data.kitchenNotes;
            $scope.showKitchenNotes = data.kitchenNotes ? true : false;
            $scope.showOrderName = false;
            $scope.orderName = data.orderName;
        };

        $http.get('/order').success(newOrderReceived);

        $scope.inc = function(article, incAmount) {
            $http.post('/order/item', {article: article._id, incAmount:incAmount}).success(function(data){
                $scope.order = data.order;
                $scope.availability = data.limits;
            });
        };

        var withKitchenNotes = function(options){
            if ($scope.order.kitchen) {
                angular.extend(options, {kitchenNotes: $scope.kitchenNotes});
            }
            return options;
        };

        $scope.commit = function(currency) {
            $http.post('/order/send', withKitchenNotes({currency: currency})).success(newOrderReceived);
        };

        $scope.voucher = function() {
            $http.post('/order/send', withKitchenNotes({voucher: true})).success(newOrderReceived);
        };
        $scope.save = function() {
            $http.post('/order/preorder', withKitchenNotes({name: $scope.orderName})).success(newOrderReceived);
        };
    }]);
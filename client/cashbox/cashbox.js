'use strict';

angular.module('bistro.cashbox', ['ui.router', 'bistro.articles', 'bistro.tags', 'bistro.focus', 'bistro.kitchen'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider.state('cashbox', {
            url: '/cashbox',
            templateUrl: 'cashbox/cashbox.html',
            controller: 'CashboxCtrl'
        });

    }])
    .value('voucherCurrency', 'chf')

    .controller('CashboxCtrl', ['$scope', 'Article', '$http', 'availableCurrencies', 'tags', 'focus', 'availabilityUpdateEventName', 'availabilityUpdate', function ($scope, Article, $http, availableCurrencies, tags, focus, availabilityUpdateEventName, availabilityUpdate) {

        Article.query({populate: 'limits.limit', sort:'name'}, function(articles){
            $scope.articles = articles;
            var tagsForArticles = tags(articles);
            $scope.tags = tagsForArticles.groupedTags;
            $scope.isSelected = tagsForArticles.isSelected;
            $scope.select = tagsForArticles.select;
            $scope.selectSingle = tagsForArticles.selectSingle;

        });

        $scope.availableCurrencies = availableCurrencies;

        $scope.showKitchenNotes = false;
        $scope.kitchenNotes = '';
        $scope.availability = {};
        $scope.order = {};

        $scope.$on(availabilityUpdateEventName, function(event, data){
            $scope.availability = data;
        });
        availabilityUpdate();

        $scope.available = function(article){
            var available = _.map(article.limits, function(limit){
                var availableByLimit = $scope.availability[limit.limit._id] || { editing: 0, preordered: 0, sent: 0, processed: 0, total: 0};
                var used = availableByLimit.total - availableByLimit.editing - availableByLimit.preordered - availableByLimit.sent - availableByLimit.processed;
                return Math.floor(used / limit.dec);
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
            $scope.lastOrder = undefined;
            $scope.given = '';
        };

        var withKitchenNotes = function(options){
            if ($scope.order.kitchen) {
                angular.extend(options, {kitchenNotes: $scope.kitchenNotes});
            }
            return options;
        };

        $scope.commit = function(currency) {
            $http.post('/order/send', withKitchenNotes({currency: currency})).success(function(data){
                $scope.lastOrder = {
                    amount: $scope.order.total[currency],
                    currency: currency
                };
                focus('given');
                newOrderReceived(data);
            });
        };

        $scope.voucher = function() {
            $http.post('/order/send', withKitchenNotes({voucher: true})).success(newOrderReceived);
        };
        $scope.save = function() {
            $http.post('/order/preorder', withKitchenNotes({name: $scope.orderName})).success(newOrderReceived);
        };
    }]);
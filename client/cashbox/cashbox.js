'use strict';

angular.module('bistro.cashbox', ['ui.router', 'bistro.articles'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider.state('cashbox', {
            url: '/cashbox',
            templateUrl: 'cashbox/cashbox.html',
            controller: 'CashboxCtrl'
        });

    }])

    .controller('CashboxCtrl', ['$scope', 'Article', '$http', function ($scope, Article, $http) {
        $scope.articles = Article.query();

        $scope.availability = {};
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

        $scope.order = {};
        $http.get('/order').success(function(data){
            $scope.order = data;
        });

        $scope.inc = function(article){
            $http.put('/order/inc', {article: article._id}).success(function(data){
                $scope.order = data.order;
                $scope.availability = data.limits;
            });
        };
        $scope.dec = function(article){
            $http.put('/order/dec', {article: article._id}).success(function(data){
                $scope.order = data.order;
                $scope.availability = data.limits;
            });
        };
    }]);
'use strict';

angular.module('bistro.articles', ['ui.router','ngResource', 'bistro.currency','bistro.limits'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('articles',{
                url: '/articles',
                templateUrl: 'articles/articles.html',
                controller: 'ArticlesCtrl'
            })
            .state('articleDetail', {
                url: '/articles/:articleId',
                templateUrl: 'articles/form.html',
                controller: 'ArticleCtrl'

        });
    }])

    .service('Article', ['$resource', function($resource){
        return $resource('/api/v1/articles/:articleId',{articleId: '@_id'});
    }])

    .controller('ArticlesCtrl', ['$scope', 'Article', 'availableCurrencies', '$state', function ($scope, Article, availableCurrencies, $state) {
        $scope.articles = Article.query({populate: 'limits.limit'});
        $scope.availableCurrencies = availableCurrencies;
        $scope.showDetail = function(article){
            $state.go('articleDetail', {articleId: article._id});
        };
    }])

    .controller('ArticleCtrl', ['$scope', '$stateParams', 'Article','Limit', 'availableCurrencies', '$state', function($scope, $stateParams, Article, Limit, availableCurrencies, $state){
        $scope.availableCurrencies = availableCurrencies;
        if ($stateParams.articleId){
            $scope.article = Article.get(angular.extend($stateParams, {populate: 'limits.limit'}));
        } else {
            $scope.article = new Article();
            $scope.article.limits = [];
            $scope.article.price = {};
            angular.forEach(availableCurrencies, function(currency){
                $scope.article.price[currency] = 0;
            });

        }

        var availableLimits = Limit.query();
        $scope.limits = function(){
            var usedLimits = _.pluck($scope.article.limits, 'limit');
            return _.reject(availableLimits, function(limit){
                return _.find(usedLimits, function(usedLimit){
                    return angular.equals(limit, usedLimit);
                });
            });
        };

        $scope.save = function() {
            $scope.article.$save();
            $state.go('articles');
        };

        $scope.remove = function(){
            $scope.article.$remove();
            $state.go('articles');
        };
    }]);
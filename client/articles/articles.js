'use strict';

angular.module('bistro.articles', ['ui.router','ngResource', 'bistro.currency'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('articles',{
                url: '/articles',
                templateUrl: 'articles/articles.html',
                controller: 'ArticlesCtrl'
            })
            .state('articleDetail', {
                url: '/articles/:articleId',
                templateUrl: 'articles/articleform.html',
                controller: 'ArticleCtrl'

        });
    }])

    .service('Article', ['$resource', function($resource){
        return $resource('/api/v1/articles/:articleId',{articleId: '@_id'});
    }])

    .controller('ArticlesCtrl', ['$scope', 'Article', 'availableCurrencies', '$state', function ($scope, Article, availableCurrencies, $state) {
        $scope.articles = Article.query();
        $scope.availableCurrencies = availableCurrencies;
        $scope.showDetail = function(article){
            $state.go('articleDetail', {articleId: article._id});
        };
    }])

    .controller('ArticleCtrl', ['$scope', '$stateParams', 'Article', 'availableCurrencies', '$state', function($scope, $stateParams, Article, availableCurrencies, $state){
        $scope.availableCurrencies = availableCurrencies;
        if ($stateParams.articleId){
            $scope.article = Article.get($stateParams)
        } else {
            $scope.article = new Article();
            $scope.article.price = {};
            angular.forEach(availableCurrencies, function(currency){
                $scope.article.price[currency] = 0;
            });

        }
        $scope.save = function() {
            $scope.article.$save();
            $state.go('articles');
        };

        $scope.remove = function(){
            $scope.article.$remove();
            $state.go('articles');
        };
    }]);
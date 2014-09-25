'use strict';

angular.module('bistro.articles', ['ui.router','ngResource'])

    .config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
        $urlRouterProvider.otherwise("/articles");
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

    .value('currencies', ['chf', 'eur'])

    .service('Article', ['$resource', function($resource){
        return $resource('/api/v1/articles/:articleId',{articleId: '@_id'});
    }])

    .controller('ArticlesCtrl', ['$scope', 'Article', 'currencies', function ($scope, Article, currencies) {
        $scope.articles = Article.query();
        $scope.currencies = currencies;
    }])

    .controller('ArticleCtrl', ['$scope', '$stateParams', 'Article', 'currencies', function($scope, $stateParams, Article, currencies){
        if ($stateParams.articleId){
            $scope.article = Article.get($stateParams)
        } else {
            $scope.article = new Article();
            $scope.article.price = {};
            angular.forEach(currencies, function(currency){
                $scope.article.price[currency] = 0;
            });
        }
    }]);
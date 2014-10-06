'use strict';

angular.module('bistro.articles', ['ui.router','ngResource', 'bistro.currency','bistro.limits'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('articles',{
                url: '/articles?group',
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

    .controller('ArticlesCtrl', ['$scope', '$stateParams', 'Article', 'availableCurrencies', '$state', function ($scope, $stateParams, Article, availableCurrencies, $state) {

        Article.query({populate: 'limits.limit'}, function(articles){
            $scope.articlesByGroup = _.groupBy(articles, function(article){
                return  article.group || 'keine Gruppe';
            });
            var group = $stateParams.group || _.keys($scope.articlesByGroup)[0];
            var articles = $scope.articlesByGroup[group];
            $scope.filter(group, articles);
        });

        $scope.availableCurrencies = availableCurrencies;

        $scope.showDetail = function(article){
            $state.go('articleDetail', {articleId: article._id});
        };

        $scope.filter = function(group, articles){
            $scope.articles = articles;
            $scope.selectedGroup = group;
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
            $state.go('articles', {group: $scope.article.group});
        };

        $scope.remove = function(){
            $scope.article.$remove();
            $state.go('articles');
        };
    }]);
'use strict';

angular.module('bistro.articles', ['ui.router','ngResource', 'bistro.currency','bistro.limits', 'bistro.tags'])

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

    .controller('ArticlesCtrl', ['$scope', '$stateParams', 'Article', 'availableCurrencies', '$state', 'tags', function ($scope, $stateParams, Article, availableCurrencies, $state, tags) {

        Article.query({populate: 'limits.limit', sort: 'name'}, function(articles){
            $scope.articles = articles;
            var tagsForArticles = tags(articles);
            $scope.tags = tagsForArticles.groupedTags;
            $scope.isSelected = tagsForArticles.isSelected;
            $scope.select = tagsForArticles.select;
            $scope.selectSingle = tagsForArticles.selectSingle;
        });

        $scope.availableCurrencies = availableCurrencies;


        $scope.showDetail = function(article){
            $state.go('articleDetail', {articleId: article._id});
        };


    }])

    .controller('ArticleCtrl', ['$scope', '$stateParams', 'Article','Limit', 'availableCurrencies', '$state', 'tags', function($scope, $stateParams, Article, Limit, availableCurrencies, $state, tags){
        $scope.tags = [];
        Article.query({}, function(articles){
            var tagsForArticles = tags(articles);
            $scope.tags = angular.copy(tagsForArticles.tags);
        });

        $scope.availableCurrencies = availableCurrencies;
        if ($stateParams.articleId){
            $scope.article = Article.get(angular.extend($stateParams, {populate: 'limits.limit'}), function(){
                if (!$scope.article.limits) {
                    $scope.article.limits = [];
                }
                if (!$scope.article.tags) {
                    $scope.article.tags = [];
                }
            });
        } else {
            $scope.article = new Article();
            $scope.article.limits = [];
            $scope.article.tags = [];
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
            $scope.article.$save(function(){
                $state.go('articles');
            });
        };

        $scope.remove = function(){
            $scope.article.$remove(function(){
                $state.go('articles');
            });
        };

        $scope.showTagSuggestions = false;

        $scope.removeTag = function(index) {
            var removedTag = $scope.article.tags.splice(index, 1);
            $scope.tags.push(removedTag[0]);
        };

        $scope.addTag = function(tag) {
            $scope.tags = _.without($scope.tags, tag);
            $scope.article.tags.push(tag);
            $scope.tagInput = '';
            $scope.showTagSuggestions = false;
        };

        $scope.addTypedTag = function($event) {
            if ($event.keyCode == 13) {
                $scope.article.tags.push($scope.tagInput);
                $scope.tags = _.without($scope.tags, $scope.tagInput);
                $scope.tagInput = '';
                $event.preventDefault();
            }
            $scope.showTagSuggestions = true;
        }
    }]);
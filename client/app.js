'use strict';

// Declare app level module which depends on views, and components
angular.module('bistro', [
  'ui.router',
  'bistro.articles'
])

.config(['$urlRouterProvider', function($urlRouterProvider) {
   $urlRouterProvider.otherwise('/articles');
}]);

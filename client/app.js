'use strict';

// Declare app level module which depends on views, and components
angular.module('bistro', [
  'ui.router',
  'bistro.cashbox',
  'bistro.articles',
  'bistro.limits'
])

.config(['$urlRouterProvider', function($urlRouterProvider) {
   $urlRouterProvider.otherwise('/cashbox');
}]);

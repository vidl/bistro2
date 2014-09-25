'use strict';

angular.module('bistro.limits', ['ui.router','ngResource'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('limits',{
                url: '/limits',
                templateUrl: 'limits/limits.html',
                controller: 'LimitsCtrl'
            })
            .state('limitDetail', {
                url: '/limits/:limitId',
                templateUrl: 'limits/form.html',
                controller: 'LimitCtrl'
            });

    }])

    .service('Limit', ['$resource', function($resource){
        return $resource('/api/v1/limits/:limitId',{limitId: '@_id'});
    }])

    .controller('LimitsCtrl', ['$scope', 'Limit', '$state', function ($scope, Limit, $state) {
        $scope.limits = Limit.query();
        $scope.showDetail = function(limit){
            $state.go('limitDetail', {limitId: limit._id});
        };
    }])

    .controller('LimitCtrl', ['$scope', '$stateParams', 'Limit', '$state', function($scope, $stateParams, Limit, $state){
        if ($stateParams.limitId){
            $scope.limit = Limit.get($stateParams)
        } else {
            $scope.limit = new Limit();

        }
        $scope.save = function() {
            $scope.limit.$save();
            $state.go('limits');
        };

        $scope.remove = function(){
            $scope.limit.$remove();
            $state.go('limits');
        };
    }]);
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
    .factory('availabilityUpdateEventName', ['$interval', '$http', '$rootScope', function($interval, $http, $rootScope){
        var eventName = 'availabilityUpdate';
        $interval(function(){
            $http.get('/availability').success(function(data){
                $rootScope.$broadcast(eventName, data);
            });
        }, 1000);
        return eventName;
    }])

    .service('Limit', ['$resource', function($resource){
        return $resource('/api/v1/limits/:limitId',{limitId: '@_id'});
    }])

    .controller('LimitsCtrl', ['$scope', 'Limit', 'availabilityUpdateEventName', '$state', '$http', function ($scope, Limit, availabilityUpdateEventName, $state, $http) {
        $scope.$on(availabilityUpdateEventName, function(event, data){
            $scope.availability = data;
        });

        $scope.increase = function(limitId, incAmount) {
            $http.post('/availability/inc', {limit: limitId, incAmount: incAmount}).success(function(data){
                $scope.availability = data;
            });
        };

        $scope.limits = Limit.query();
        $scope.showDetail = function(limit){
            $state.go('limitDetail', {limitId: limit._id});
        };
    }])

    .controller('LimitCtrl', ['$scope', '$stateParams', 'Limit', '$state', function($scope, $stateParams, Limit, $state){
        if ($stateParams.limitId){
            $scope.limit = Limit.get($stateParams);
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
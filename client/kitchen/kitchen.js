'use strict';
(function() {
    const eventName = 'availabilityUpdate';
    const orderEventName = 'orders';

    angular.module('bistro.kitchen', ['ui.router', 'ngResource', 'bistro.orders'])

        .config(['$stateProvider', function ($stateProvider) {
            $stateProvider
                .state('kitchen', {
                    url: '/kitchen',
                    templateUrl: 'kitchen/kitchen.html',
                    controller: 'KitchenCtrl'
                });

        }])
        .service('availabilityUpdate', ['$http', '$rootScope', 'Order', function ($http, $rootScope, Order) {
            return function () {
                $http.get('/availability').success(function (data) {
                    $rootScope.$broadcast(eventName, data);
                });
                Order.query({state: 'sent', sort: 'no', populate: 'items.article'}, function(orders){
                    $rootScope.$broadcast(orderEventName, orders);
                });
            }
        }])
        .factory('availabilityUpdateEventName', ['$interval', 'availabilityUpdate', function ($interval, availabilityUpdate) {
            $interval(availabilityUpdate, 1000);
            return eventName;
        }])


        .controller('KitchenCtrl', ['$scope','availabilityUpdate', 'availabilityUpdateEventName', '$state', '$http', function ($scope, availabilityUpdate, availabilityUpdateEventName, $state, $http) {
            $scope.$on(availabilityUpdateEventName, function (event, data) {
                $scope.availability = data;
            });
            $scope.$on(orderEventName, function(event, orders){
                $scope.orders = orders;
            });
            availabilityUpdate();

            $scope.increase = function (limitId, incAmount) {
                $http.post('/availability/inc', {limit: limitId, incAmount: incAmount}).success(function (data) {
                    $scope.availability = data;
                });
            };

            $scope.processed = function(index) {
                var order = $scope.orders[index];
                $http.post('/order/processed', {order: order._id}).success(function(){
                    $scope.orders.splice(index, 1);
                });
            }
        }]);
})();
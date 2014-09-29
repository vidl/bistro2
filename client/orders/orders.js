'use strict';

angular.module('bistro.orders', ['ui.router','ngResource', 'bistro.date'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('orders',{
                url: '/orders',
                templateUrl: 'orders/orders.html',
                controller: 'OrdersCtrl'
            })
            .state('orderDetail', {
                url: '/orders/:orderId',
                templateUrl: 'orders/form.html',
                controller: 'OrderCtrl'
            });

    }])

    .service('Order', ['$resource', function($resource){
        return $resource('/api/v1/orders/:orderId',{orderId: '@_id'});
    }])

    .controller('OrdersCtrl', ['$scope', 'Order', '$state', function ($scope, Order, $state) {
        $scope.orders = Order.query({sort: '-updatedAt'});
        $scope.showDetail = function(order){
            $state.go('orderDetail', {orderId: order._id});
        };
    }])

    .controller('OrderCtrl', ['$scope', '$stateParams', 'Order', '$state', function($scope, $stateParams, Order, $state){
        $scope.order = Order.get(angular.extend($stateParams, {populate: 'items.article'}));
        $scope.remove = function(){
            $scope.order.$remove();
            $state.go('orders');
        };
    }]);
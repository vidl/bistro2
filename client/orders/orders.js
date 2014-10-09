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
    .value('orderState', {editing: 'erfassen', preordered: 'vorgemerkt', sent: 'gesendet'})

    .service('Order', ['$resource', function($resource){
        return $resource('/api/v1/orders/:orderId',{orderId: '@_id'});
    }])

    .controller('OrdersCtrl', ['$scope', 'Order', 'orderState', '$state', function ($scope, Order, orderState, $state) {
        $scope.orderState = orderState;
        $scope.orders = Order.query({sort: '-updatedAt'});
        $scope.showDetail = function(order){
            $state.go('orderDetail', {orderId: order._id});
        };
    }])

    .controller('OrderCtrl', ['$scope', '$stateParams', 'Order', '$state', '$http', function($scope, $stateParams, Order, $state, $http){
        $scope.order = Order.get(angular.extend($stateParams, {populate: 'items.article'}));
        $scope.remove = function(){
            $scope.order.$remove();
            $state.go('orders');
        };
        $scope.select = function() {
            $http.post('/order/select', {order: $scope.order._id}).success(function(){
                $state.go('cashbox');
            });
        };
        $scope.print = function(request){
            $http.get('/order/print/' + request + '/' + $scope.order._id);
        };
    }]);
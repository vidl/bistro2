'use strict';

angular.module('bistro.printJobs', ['ui.router','ngResource', 'bistro.date'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('printJobs',{
                url: '/printJobs',
                templateUrl: 'printJobs/printJobs.html',
                controller: 'PrintJobsCtrl'
            });


    }])

    .filter('translateTypes', function(){
        var types = {
            kitchen: 'Küche',
            receipt: 'Bon'
        };
        return function(type){
          return types[type] || 'unbekannt';
        };
    })

    .service('PrintJob', ['$resource', function($resource){
        return $resource('/api/v1/printJobs/:printJobId',{printJobId: '@_id'});
    }])


    .controller('PrintJobsCtrl', ['$scope', 'PrintJob', '$http', function ($scope, PrintJob, $http) {
        $scope.printJobs = PrintJob.query({sort: '-updatedAt'});
        $scope.cancel = function(printJob){
            $http.post('/printJob/cancel', {printJob: printJob._id}).success(function(){
                $scope.printJobs = PrintJob.query({sort: '-updatedAt'});
            });
        };

    }]);

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
            receipt: 'Beleg'
        };
        return function(type){
          return types[type] || 'unbekannt';
        };
    })

    .service('PrintJob', ['$resource', function($resource){
        return $resource('/api/v1/printJobs/:printJobId',{printJobId: '@_id'});
    }])

    .service('printJobs', ['PrintJob', '$interval', function(PrintJob, $interval){
        var printJobs = [];
        /*$interval(function(){
            PrintJob.query({sort: '-updatedAt'}, function(data){
                while(printJobs.length > 0) {
                    printJobs.pop();
                }
                printJobs.push.apply(printJobs, data);
            });
        }, 1000);*/
        return printJobs;
    }])

    .filter('pendingJobsCount', ['printJobs', function(printJobs){
        return function() {
            var pendingJobsCount = _.reduce(printJobs, function(count, printJob){
                return count + (printJob.pending ? 1 : 0);
            },0);
            return pendingJobsCount || undefined;
        }
    }])

    .controller('PrintJobsCtrl', ['$scope', 'printJobs', '$http', function ($scope, printJobs, $http) {
        $scope.printJobs = printJobs;
        $scope.cancel = function(printJob){
            $http.post('/printJob/cancel', {printJob: printJob._id}).success(function(){
                var index = $scope.printJobs.indexOf(printJob);
                if (index > -1) {
                    $scope.printJobs.splice(index, 1);
                }
            });
        };

    }]);

'use strict';

angular.module('bistro.settings', ['ui.router','ngResource'])

    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('settings',{
                url: '/settings',
                templateUrl: 'settings/settings.html',
                controller: 'SettingsCtrl'
            })
            .state('settingPrinter', {
                url: '/settings/printer/:settingId',
                templateUrl: 'settings/formPrinter.html',
                controller: 'SettingCtrl'

            })
            .state('settingTagGroups', {
                url: '/settings/tagGroups/:settingId',
                templateUrl: 'settings/formTagGroups.html',
                controller: 'SettingCtrl'

            })
        ;


    }])

    .service('Setting', ['$resource', function($resource){
        return $resource('/api/v1/settings/:settingId',{settingId: '@_id'});
    }])

    .service('availablePrinters', ['$http', function($http){
        var availablePrinters = [];
        $http.get('/availablePrinters').success(function(data){
            availablePrinters.push.apply(availablePrinters, data); // add all to the existing array (do not modify the reference)
        });
        return availablePrinters;
    }])

    .controller('SettingsCtrl', ['$scope', 'Setting', '$state', function ($scope, Setting, $state) {
        $scope.settings = Setting.query();
        $scope.showDetail = function(setting){
            $state.go('setting' + setting.type, {settingId: setting._id});
        };

    }])

    .controller('SettingCtrl', ['$scope', '$stateParams', 'Setting', 'availablePrinters', '$state', function($scope, $stateParams, Setting, availablePrinters, $state){
        $scope.availablePrinters = availablePrinters;
        $scope.setting = Setting.get($stateParams);


        $scope.save = function() {
            $scope.setting.$save();
            $state.go('settings');
        };

        $scope.remove = function(){
            $scope.article.$remove();
            $state.go('settings');
        };
    }]);

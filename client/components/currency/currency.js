angular.module('bistro.currency',['bistro.currency.directive','bistro.currency.filter'])
    .service('availableCurrencies', ['$http', function($http){
        var availableCurrencies = [];
        $http.get('/currencies').success(function(data){
           availableCurrencies.push.apply(availableCurrencies, data); // add all to the existing array (do not modify the reference)
        });
        return availableCurrencies;
    }])
;

angular.module('bistro.date.filter',[])
    .filter('bistroDate', function(){
        return function(date, format){
            return moment(date).format(format || 'L');
        }
    })
    .filter('bistroTime', function(){
        return function(date, format){
            return moment(date).format(format || 'LT');
        }
    })
    .filter('bistroFromNow', function(){
        return function(date){
            return moment(date).fromNow();
        }
    })
;

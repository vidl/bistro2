(function() {
    var selectedTags = [];

    var filter = function(articlesArray) {
        return _.filter(articlesArray, function(article){
            return _.intersection(article.tags, selectedTags).length == selectedTags.length;
        });
    };

    var getTagsFromArticles = function(articles) {
        var tags = [];
        var usedTags = {};
        _.each(articles, function(article){
            _.each(article.tags || [], function(tag){
                usedTags[tag] = 1;
            });
        });
        _.each(usedTags, function(value, key){
            tags.push(key);
        });
        return tags;
    };

    var groupTagsByExpression = function(tags, groupExpressions) {
        var tagGroups = [];
        _.each(groupExpressions, function(){
            tagGroups.push([]);
        });
        tagGroups.push([]);
        _.each(tags, function(tag) {
            var matched = false;
            for(i = 0; i < groupExpressions.length && !matched; i++) {
                matched = groupExpressions[i].test(tag);
                if (matched) {
                    tagGroups[i].push(tag);
                }
            }
            if (!matched) {
                tagGroups[groupExpressions.length].push(tag);
            }
        });
        return tagGroups;
    };

angular.module('bistro.tags',[])

    .service('tags', ['$http', function($http){
        var groupExpressions = [];
        $http.get('/tagGroups').success(function(data){
            groupExpressions = _.map(data.value.split('\n'), function(ex){
                return new RegExp(ex);
            });
        });

        return function(articles) {
            var tags = getTagsFromArticles(articles);
            var groupedTags = groupTagsByExpression(tags, groupExpressions);

            return {
                tags: tags,
                groupedTags: groupedTags,
                selectedTags: selectedTags,
                
                isSelected: function(tag) {
                    return selectedTags.indexOf(tag) >= 0
                },
                select: function(tag) {
                    var index = selectedTags.indexOf(tag);
                    if (index >= 0) {
                        selectedTags.splice(index, 1);
                    } else {
                        selectedTags.push(tag);
                    }
                    if (filter(articles).length == 0) {
                        this.selectSingle(tag);
                    }
                },
                selectSingle: function(tag) {
                    selectedTags.length = 0;
                    selectedTags.push(tag);
                }
            };
        };
    }])

    .filter('filterByTags', ['tags', function(tags){
        return filter;
    }])

;
})();

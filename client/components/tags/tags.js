angular.module('bistro.tags',[])
    .service('tags', [function(){
        var tags = [];
        var selectedTags = [];

        return {
            setFromArticles: function(articles) {
                while(tags.length > 0) {
                    tags.pop();
                }
                var usedTags = {};
                _.each(articles, function(article){
                    _.each(article.tags || [], function(tag){
                        usedTags[tag] = 1;
                    });
                });
                _.each(usedTags, function(value, key){
                    tags.push(key);
                });
            },
            getAvailableTags: function() {
                return tags;
            },
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
            },
            selectSingle: function(tag) {
                selectedTags.length = 0;
                selectedTags.push(tag);
            },
            getSelected: function() {
                return selectedTags;
            }
        };
    }])
    .filter('filterByTags', ['tags', function(tags){
        return function(articles) {
            var selectedTags = tags.getSelected();
            return _.filter(articles, function(article){
                return _.intersection(article.tags, selectedTags).length == selectedTags.length;
            });
        };
    }])

;

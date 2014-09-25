module.exports = function(grunt) {

    // Load grunt tasks automatically
    require('load-grunt-tasks')(grunt);
    var _ = require('underscore');
    String.prototype.endsWith = function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };

    var replaceScripts = function(param){
        var indent =  /([ \t]*)<!--.*/.exec(param)[1];
        var scripts = '<!-- @@NG_SCRIPTS_START@@ -->\r\n';
        var clientDir = grunt.config.data.clientDir;
        var expandOptions = { cwd: clientDir };
        var files = grunt.file.expand(expandOptions,
            '**/*.js',
            '!**/*_test.js',
            '!bower_components/**'
        );
        var options = {
            data: {
                indent: indent,
                path: null
            }
        };
        var mapFunction = function (f) {
            options.data.path = f;
            return grunt.template.process('<%= indent %><script src="<%= path %>"></script>', options);
        };
        scripts += _.map(files, mapFunction).join('\r\n');
        scripts +=  '\r\n' + indent + '<!-- @@NG_SCRIPTS_END@@ -->';
        return scripts;
    };

    // Project configuration.
    grunt.initConfig({
        // Watches files for changes and runs tasks based on the changed files
        clientDir: 'client',
        watch: {
            bower: {
                files: ['bower.json'],
                tasks: ['wiredep']
            },
            js: {
                files: ['<%= clientDir %>/**/*.js'],
                tasks: ['replace:js'],
                options: {
                    event: ['added', 'deleted']
                }
            }
        },
        // Automatically inject Bower components into the app
        wiredep: {
            app: {
                src: ['<%= clientDir %>/index.html'],
                ignorePath:  /\.\.\//
            }
        },
        replace: {
            js: {
                src: ['<%= clientDir %>/index.html'],
                overwrite: true,
                replacements: [{
                    from: /(([ \t]*)<!--\s*@@NG_SCRIPTS_START@@\s*-->)(\n|\r|.)*?(<!--\s*@@NG_SCRIPTS_END@@\s*-->)/gi,
                    to: replaceScripts
                }]
            }
        },

        pkg: grunt.file.readJSON('package.json')
    });


    // Default task(s).
    grunt.registerTask('default', ['watch']);

};
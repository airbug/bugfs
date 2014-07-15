//-------------------------------------------------------------------------------
// Requires
//-------------------------------------------------------------------------------

var buildbug            = require('buildbug');


//-------------------------------------------------------------------------------
// Simplify References
//-------------------------------------------------------------------------------

var buildProject        = buildbug.buildProject;
var buildProperties     = buildbug.buildProperties;
var buildTarget         = buildbug.buildTarget;
var enableModule        = buildbug.enableModule;
var parallel            = buildbug.parallel;
var series              = buildbug.series;
var targetTask          = buildbug.targetTask;


//-------------------------------------------------------------------------------
// Enable Modules
//-------------------------------------------------------------------------------

var aws                 = enableModule("aws");
var bugpack             = enableModule('bugpack');
var bugunit             = enableModule('bugunit');
var core                = enableModule('core');
var nodejs              = enableModule('nodejs');


//-------------------------------------------------------------------------------
// Values
//-------------------------------------------------------------------------------

var version             = "0.1.3";
var dependencies        = {
    bugpack: "0.1.9"
};


//-------------------------------------------------------------------------------
// BuildProperties
//-------------------------------------------------------------------------------

buildProperties({
    node: {
        packageJson: {
            name: "bugfs",
            version: version,
            description: "Convenience library for interacting with file system in node js. Built using bugcore library.",
            main: "./scripts/bugfs-node-module.js",
            dependencies: dependencies,
            author: "Brian Neisler <brian@airbug.com>",
            repository: {
                type: "git",
                url: "https://github.com/airbug/bugfs.git"
            },
            bugs: {
                url: "https://github.com/airbug/bugfs/issues"
            },
            licenses: [
                {
                    type : "MIT",
                    url : "https://raw.githubusercontent.com/airbug/bugfs/master/LICENSE"
                }
            ]
        },
        sourcePaths: [
            "../bugcore/projects/bugcore/js/src",
            "./projects/bugfs/js/src"
        ],
        scriptPaths: [
            "./projects/bugfs-node/js/scripts"
        ],
        readmePath: "./README.md",
        unitTest: {
            packageJson: {
                name: "bugfs-test",
                version: version,
                main: "./scripts/bugfs-node-module.js",
                dependencies: dependencies,
                scripts: {
                    test: "./scripts/bugunit-run.js"
                }
            },
            sourcePaths: [
                "../buganno/projects/buganno/js/src",
                "../bugfs/projects/bugfs/js/src",
                "../bugmeta/projects/bugmeta/js/src",
                "../bugunit/projects/bugdouble/js/src",
                "../bugunit/projects/bugunit/js/src"
            ],
            scriptPaths: [
                "../buganno/projects/buganno/js/scripts",
                "../bugunit/projects/bugunit/js/scripts"
            ],
            testPaths: [
                "./projects/bugfs/js/test"
            ]
        }
    },
    lint: {
        targetPaths: [
            "."
        ],
        ignorePatterns: [
            ".*\\.buildbug$",
            ".*\\.bugunit$",
            ".*\\.git$",
            ".*node_modules$"
        ]
    }
});


//-------------------------------------------------------------------------------
// BuildTargets
//-------------------------------------------------------------------------------

// Clean BuildTarget
//-------------------------------------------------------------------------------

buildTarget('clean').buildFlow(
    targetTask('clean')
);


// Local BuildTarget
//-------------------------------------------------------------------------------

buildTarget('local').buildFlow(
    series([
        targetTask('clean'),
        targetTask('lint', {
            properties: {
                targetPaths: buildProject.getProperty("lint.targetPaths"),
                ignores: buildProject.getProperty("lint.ignorePatterns"),
                lintTasks: [
                    "cleanupExtraSpacingAtEndOfLines",
                    "ensureNewLineEnding",
                    "indentEqualSignsForPreClassVars",
                    "orderBugpackRequires",
                    "orderRequireAnnotations",
                    "updateCopyright"
                ]
            }
        }),
        series([
            targetTask('createNodePackage', {
                properties: {
                    packageJson: buildProject.getProperty("node.packageJson"),
                    readmePath: buildProject.getProperty("node.readmePath"),
                    sourcePaths: buildProject.getProperty("node.sourcePaths").concat(
                        buildProject.getProperty("node.unitTest.sourcePaths")
                    ),
                    scriptPaths: buildProject.getProperty("node.scriptPaths").concat(
                        buildProject.getProperty("node.unitTest.scriptPaths")
                    ),
                    testPaths: buildProject.getProperty("node.unitTest.testPaths")
                }
            }),
            targetTask('generateBugPackRegistry', {
                init: function(task, buildProject, properties) {
                    var nodePackage = nodejs.findNodePackage(
                        buildProject.getProperty("node.packageJson.name"),
                        buildProject.getProperty("node.packageJson.version")
                    );
                    task.updateProperties({
                        sourceRoot: nodePackage.getBuildPath()
                    });
                }
            }),
            targetTask('packNodePackage', {
                properties: {
                    packageName: "{{node.packageJson.name}}",
                    packageVersion: "{{node.packageJson.version}}"
                }
            }),
            targetTask('startNodeModuleTests', {
                init: function(task, buildProject, properties) {
                    var packedNodePackage = nodejs.findPackedNodePackage(
                        buildProject.getProperty("node.packageJson.name"),
                        buildProject.getProperty("node.packageJson.version")
                    );
                    task.updateProperties({
                        modulePath: packedNodePackage.getFilePath()
                        //checkCoverage: true
                    });
                }
            }),
            targetTask("s3PutFile", {
                init: function(task, buildProject, properties) {
                    var packedNodePackage = nodejs.findPackedNodePackage(buildProject.getProperty("node.packageJson.name"),
                        buildProject.getProperty("node.packageJson.version"));
                    task.updateProperties({
                        file: packedNodePackage.getFilePath(),
                        options: {
                            acl: 'public-read',
                            encrypt: true
                        }
                    });
                },
                properties: {
                    bucket: "{{local-bucket}}"
                }
            })
        ])
    ])
).makeDefault();


// Prod BuildTarget
//-------------------------------------------------------------------------------

buildTarget('prod').buildFlow(
    series([
        targetTask('clean'),
        targetTask('lint', {
            properties: {
                targetPaths: buildProject.getProperty("lint.targetPaths"),
                ignores: buildProject.getProperty("lint.ignorePatterns"),
                lintTasks: [
                    "cleanupExtraSpacingAtEndOfLines",
                    "ensureNewLineEnding",
                    "indentEqualSignsForPreClassVars",
                    "orderBugpackRequires",
                    "orderRequireAnnotations",
                    "updateCopyright"
                ]
            }
        }),
        parallel([

            //Create test node bugfs package

            series([
                targetTask('createNodePackage', {
                    properties: {
                        packageJson: buildProject.getProperty("node.unitTest.packageJson"),
                        sourcePaths: buildProject.getProperty("node.sourcePaths").concat(
                            buildProject.getProperty("node.unitTest.sourcePaths")
                        ),
                        scriptPaths: buildProject.getProperty("node.scriptPaths").concat(
                            buildProject.getProperty("node.unitTest.scriptPaths")
                        ),
                        testPaths: buildProject.getProperty("node.unitTest.testPaths")
                    }
                }),
                targetTask('generateBugPackRegistry', {
                    init: function(task, buildProject, properties) {
                        var nodePackage = nodejs.findNodePackage(
                            buildProject.getProperty("node.unitTest.packageJson.name"),
                            buildProject.getProperty("node.unitTest.packageJson.version")
                        );
                        task.updateProperties({
                            sourceRoot: nodePackage.getBuildPath()
                        });
                    }
                }),
                targetTask('packNodePackage', {
                    properties: {
                        packageName: "{{node.unitTest.packageJson.name}}",
                        packageVersion: "{{node.unitTest.packageJson.version}}"
                    }
                }),
                targetTask('startNodeModuleTests', {
                    init: function(task, buildProject, properties) {
                        var packedNodePackage = nodejs.findPackedNodePackage(
                            buildProject.getProperty("node.unitTest.packageJson.name"),
                            buildProject.getProperty("node.unitTest.packageJson.version")
                        );
                        task.updateProperties({
                            modulePath: packedNodePackage.getFilePath(),
                            checkCoverage: true
                        });
                    }
                 })
            ]),

            // Create production node bugfs package

            series([
                targetTask('createNodePackage', {
                    properties: {
                        packageJson: buildProject.getProperty("node.packageJson"),
                        readmePath: buildProject.getProperty("node.readmePath"),
                        sourcePaths: buildProject.getProperty("node.sourcePaths"),
                        scriptPaths: buildProject.getProperty("node.scriptPaths")
                    }
                }),
                targetTask('generateBugPackRegistry', {
                    init: function(task, buildProject, properties) {
                        var nodePackage = nodejs.findNodePackage(
                            buildProject.getProperty("node.packageJson.name"),
                            buildProject.getProperty("node.packageJson.version")
                        );
                        task.updateProperties({
                            sourceRoot: nodePackage.getBuildPath()
                        });
                    }
                }),
                targetTask('packNodePackage', {
                    properties: {
                        packageName: "{{node.packageJson.name}}",
                        packageVersion: "{{node.packageJson.version}}"
                    }
                }),
                targetTask("s3PutFile", {
                    init: function(task, buildProject, properties) {
                        var packedNodePackage = nodejs.findPackedNodePackage(buildProject.getProperty("node.packageJson.name"),
                            buildProject.getProperty("node.packageJson.version"));
                        task.updateProperties({
                            file: packedNodePackage.getFilePath(),
                            options: {
                                acl: 'public-read',
                                encrypt: true
                            }
                        });
                    },
                    properties: {
                        bucket: "{{prod-deploy-bucket}}"
                    }
                }),
                targetTask('npmConfigSet', {
                    properties: {
                        config: buildProject.getProperty("npmConfig")
                    }
                }),
                targetTask('npmAddUser'),
                targetTask('publishNodePackage', {
                    properties: {
                        packageName: "{{node.packageJson.name}}",
                        packageVersion: "{{node.packageJson.version}}"
                    }
                })
            ])
        ])
    ])
);


//-------------------------------------------------------------------------------
// Build Scripts
//-------------------------------------------------------------------------------

buildScript({
    dependencies: [
        "bugcore",
        "bugflow",
        "bugfs"
    ],
    script: "./lintbug.js"
});

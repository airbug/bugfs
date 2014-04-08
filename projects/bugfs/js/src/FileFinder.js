//-------------------------------------------------------------------------------
// Annotations
//-------------------------------------------------------------------------------

//@Export('bugfs.FileFinder')

//@Require('Bug')
//@Require('Class')
//@Require('List')
//@Require('Obj')
//@Require('Set')
//@Require('TypeUtil')
//@Require('bugflow.BugFlow')
//@Require('bugfs.BugFs')


//-------------------------------------------------------------------------------
// Common Modules
//-------------------------------------------------------------------------------

var bugpack             = require('bugpack').context();


//-------------------------------------------------------------------------------
// BugPack
//-------------------------------------------------------------------------------

var Bug                 = bugpack.require('Bug');
var Class               = bugpack.require('Class');
var List                = bugpack.require('List');
var Obj                 = bugpack.require('Obj');
var Set                 = bugpack.require('Set');
var TypeUtil            = bugpack.require('TypeUtil');
var BugFlow             = bugpack.require('bugflow.BugFlow');
var BugFs               = bugpack.require('bugfs.BugFs');


//-------------------------------------------------------------------------------
// Simplify References
//-------------------------------------------------------------------------------

var $forEachParallel    = BugFlow.$forEachParallel;
var $if                 = BugFlow.$if;
var $series             = BugFlow.$series;
var $task               = BugFlow.$task;


//-------------------------------------------------------------------------------
// Declare Class
//-------------------------------------------------------------------------------

/**
 * @class
 * @extends {Obj}
 */
var FileFinder = Class.extend(Obj, {

    //-------------------------------------------------------------------------------
    // Constructor
    //-------------------------------------------------------------------------------

    _constructor: function(matchPatterns, ignorePatterns) {

        this._super();


        //-------------------------------------------------------------------------------
        // Private Properties
        //-------------------------------------------------------------------------------

        /**
         * @private
         * @type {List.<(RegExp | string)>}
         */
        this.ignorePatternList  = new List(ignorePatterns);

        /**
         * @private
         * @type {List.<(RegExp | string)>}
         */
        this.matchPatternList   = new List(matchPatterns);
    },


    //-------------------------------------------------------------------------------
    // Public Methods
    //-------------------------------------------------------------------------------

    /**
     * @param {Array.<(string | Path)> | Collection.<(string | Path)>} scanPaths
     * @param {function(Throwable, Set.<Path>=)} callback
     */
    scan: function(scanPaths, callback) {
        var _this = this;
        /** @type {Set.<Path>} */
        var matchingPaths = new Set();
        if (TypeUtil.isArray(scanPaths)) {
            $forEachParallel(scanPaths, function(flow, scanPath) {
                scanPath = BugFs.path(scanPath);
                _this.scanPathForMatchingFiles(scanPath, function(error, matchedPaths) {
                    if (!error) {
                        matchingPaths.addAll(matchedPaths);
                    }
                    flow.complete(error);
                });
            }).execute(function(error) {
                if (!error) {
                    callback(null, matchingPaths);
                } else {
                    callback(error);
                }
            });
        } else {
            callback(new Bug("IllegalArgument", {}, "scanPaths must be an Array and must not be empty"));
        }
    },


    //-------------------------------------------------------------------------------
    // Private Class Methods
    //-------------------------------------------------------------------------------

    /**
     * @private
     * @param {Path} filePath
     * @return {boolean}
     */
    checkFileMatch: function(filePath) {
        var matched = false;
        this.matchPatternList.forEach(function(matchPattern) {
            if (TypeUtil.isString(matchPattern)) {
                matchPattern = new RegExp(matchPattern);
            }
            if (filePath.getAbsolutePath().match(matchPattern)) {
                matched = true;
            }
        });
        return matched;
    },

    /**
     * @private
     * @param {Path} path
     * @return {boolean}
     */
    checkPathIgnore: function(path) {
        var ignored = false;
        this.ignorePatternList.forEach(function(ignorePattern) {
            if (TypeUtil.isString(ignorePattern)) {
                ignorePattern = new RegExp(ignorePattern);
            }
            if (path.getAbsolutePath().match(ignorePattern)) {
                ignored = true;
            }
        });
        return ignored;
    },

    /**
     * @private
     * @param {Path} path
     * @param {function(Throwable, Set.<Path>=)} callback
     */
    scanDirectoryForMatchingFiles: function(path, callback) {
        var _this = this;
        var matchingPaths = new Set();
        var scanPaths = null;
        $series([
            $task(function(flow) {
                path.readDirectory(true, function(error, paths) {
                    if (!error) {
                        scanPaths = paths;
                        flow.complete();
                    } else {
                        flow.error(error);
                    }
                });
            }),
            $task(function(flow) {
                if (scanPaths) {
                    $forEachParallel(scanPaths, function(flow, scanPath) {
                        _this.scanPathForMatchingFiles(scanPath, function(error, matchingFiles) {
                            if (!error) {
                                matchingPaths.addAll(matchingFiles);
                            }
                            flow.complete(error);
                        })
                    }).execute(function(error) {
                        flow.complete(error);
                    });
                } else {
                    flow.complete();
                }
            })
        ]).execute(function(error) {
            if (!error) {
                callback(null, matchingPaths);
            } else {
                callback(error);
            }
        });
    },

    /**
     * @private
     * @param {Path} scanPath
     * @param {function(Throwable, Set.<Path>=)} callback
     */
    scanPathForMatchingFiles: function(scanPath, callback) {
        var _this = this;
        var sourcePaths = new Set();
        $if(function(flow) {
                scanPath.isDirectory(true, function(error, isDirectory) {
                    if (!error) {
                        flow.assert(isDirectory);
                    } else {
                        flow.error(error);
                    }
                });
            },
            $task(function(flow) {
                if (!_this.checkPathIgnore(scanPath)) {
                    _this.scanDirectoryForMatchingFiles(scanPath, function(error, sourceFiles) {
                        if (!error) {
                            sourcePaths.addAll(sourceFiles);
                        }
                        flow.complete(error);
                    });
                } else {
                    flow.complete();
                }
            })
        ).$elseIf(function(flow) {
                scanPath.isFile(true, function(error, isFile) {
                    if (!error) {
                        flow.assert(isFile);
                    } else {
                        flow.error(error);
                    }
                });
            },
            $task(function(flow) {
                if (!_this.checkPathIgnore(scanPath)) {
                    if (_this.checkFileMatch(scanPath)) {
                        sourcePaths.add(scanPath);
                    }
                }
                flow.complete();
            })
        ).execute(function(error) {
            if (!error) {
                callback(null, sourcePaths);
            } else {
                callback(error);
            }
        });
    }
});


//-------------------------------------------------------------------------------
// Export
//-------------------------------------------------------------------------------

bugpack.export('bugfs.FileFinder', FileFinder);

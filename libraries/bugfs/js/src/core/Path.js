/*
 * Copyright (c) 2014 airbug inc. http://airbug.com
 *
 * bugfs may be freely distributed under the MIT license.
 */


//-------------------------------------------------------------------------------
// Annotations
//-------------------------------------------------------------------------------

//@Export('bugfs.Path')

//@Require('Class')
//@Require('Exception')
//@Require('Flows')
//@Require('Obj')
//@Require('Promises')
//@Require('Semaphore')
//@Require('Tracer')
//@Require('TypeUtil')


//-------------------------------------------------------------------------------
// Context
//-------------------------------------------------------------------------------

require('bugpack').context("*", function(bugpack) {

    //-------------------------------------------------------------------------------
    // Common Modules
    //-------------------------------------------------------------------------------

    var fs                  = require('fs');
    var path                = require('path');


    //-------------------------------------------------------------------------------
    // BugPack
    //-------------------------------------------------------------------------------

    var Class               = bugpack.require('Class');
    var Exception           = bugpack.require('Exception');
    var Flows               = bugpack.require('Flows');
    var Obj                 = bugpack.require('Obj');
    var Promises            = bugpack.require('Promises');
    var Semaphore           = bugpack.require('Semaphore');
    var Tracer              = bugpack.require('Tracer');
    var TypeUtil            = bugpack.require('TypeUtil');


    //-------------------------------------------------------------------------------
    // Simplify References
    //-------------------------------------------------------------------------------

    var $forEachParallel    = Flows.$forEachParallel;
    var $if                 = Flows.$if;
    var $series             = Flows.$series;
    var $task               = Flows.$task;
    var $trace              = Tracer.$trace;
    var $traceWithError     = Tracer.$traceWithError;


    //-------------------------------------------------------------------------------
    // Declare Class
    //-------------------------------------------------------------------------------

    /**
     * @class
     * @extends {Obj}
     */
    var Path = Class.extend(Obj, {

        _name: "bugfs.Path",


        //-------------------------------------------------------------------------------
        // Constructor
        //-------------------------------------------------------------------------------

        /**
         * @constructs
         * @param {(Path | string)}  givenPath
         */
        _constructor: function(givenPath) {

            this._super();


            //-------------------------------------------------------------------------------
            // Private Properties
            //-------------------------------------------------------------------------------

            /**
             * @private
             * @type {string}
             */
            this.givenPath = Class.doesExtend(givenPath, Path) ? givenPath.getGivenPath() : givenPath;
        },


        //-------------------------------------------------------------------------------
        // Getters and Setters
        //-------------------------------------------------------------------------------

        /**
         * @return {string}
         */
        getAbsolutePath: function() {
            return path.resolve(this.givenPath);
        },

        /**
         * @return {string}
         */
        getBaseName: function() {
            return path.basename(this.getAbsolutePath(), this.getExtName());
        },

        /**
         * @return {string}
         */
        getExtName: function() {
            return path.extname(this.getAbsolutePath());
        },

        /**
         * @return {string}
         */
        getGivenPath: function() {
            return this.givenPath;
        },

        /**
         * @return {string}
         */
        getName: function() {
            return path.basename(this.getAbsolutePath());
        },

        /**
         * @return {Path}
         */
        getParentPath: function() {
            //TODO BRN: Figure out how this behaves when we get down to the /
            var parentPath = path.dirname(this.getAbsolutePath());
            return new Path(parentPath);
        },

        /**
         * @param {Path} intoPath
         * @return {string}
         */
        getRelativePath: function(intoPath) {
            return path.relative(this.getAbsolutePath(), intoPath.getAbsolutePath());
        },

        /**
         * @return {boolean}
         */
        isGivenPathAbsolute: function() {
            if (path.sep === "/") {
                return /^\//.test(this.givenPath);
            } else {
                return /^(?:[A-Za-z]:)?\\/.test(this.givenPath);
            }
            return true;
        },


        //-------------------------------------------------------------------------------
        // Object Implementation
        //-------------------------------------------------------------------------------

        /**
         * @param {*} value
         * @return {boolean}
         */
        equals: function(value) {
            if (Class.doesExtend(value, Path)) {
                return (value.getAbsolutePath() === this.getAbsolutePath());
            }
            return false;
        },

        /**
         * @return {number}
         */
        hashCode: function() {
            if (!this._hashCode) {
                this._hashCode = Obj.hashCode("[Path]" + Obj.hashCode(this.getAbsolutePath()));
            }
            return this._hashCode;
        },


        //-------------------------------------------------------------------------------
        // Public Methods
        //-------------------------------------------------------------------------------

        //TODO BRN: add option for "preserve" See http://en.wikipedia.org/wiki/Cp_(Unix) for description. Determine if node js already does this under the hood.

        /**
         * Rules for copy
         * 1) If this Path is a directory, it will perform a copyDirectory call
         * 2) If this Path is a file, it will perform a copyFile call
         * @param {(string|Path)} intoPath
         * @param {(boolean|function(Throwable, Path=))=} recursive (defaults to true)
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {(boolean|function(Throwable, Path=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable, Path=)=} callback
         */
        copy: function(intoPath, recursive, syncMode, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            if (TypeUtil.isFunction(recursive)) {
                callback = recursive;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;
            var _copyPath = null;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot copy path '" + _this.getAbsolutePath() + "' because it does " +
                                        "not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._generateTargetPath(intoPath, resolveSymlink, function(error, targetPath) {
                            _copyPath = targetPath;
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copy(_copyPath, recursive, syncMode, resolveSymlink, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(null, _copyPath);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(string | Path)} intoPath
         * @param {(boolean|function(Throwable, Path=))=} recursive (defaults to true)
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {(boolean|function(Throwable, Path=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable, Path=)=} callback
         */
        copyContents: function(intoPath, recursive, syncMode, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            if (TypeUtil.isFunction(recursive)) {
                callback = recursive;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;


            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot copy path contents '" + _this.getAbsolutePath() + "' because it does " +
                                        "not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyContents(intoPath, recursive, syncMode, resolveSymlink, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(null, intoPath);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {?boolean=} recursive
         * @param {?Path.SyncMode=} syncMode
         * @param {?boolean=} resolveSymlink (defaults to false)
         * @return {Path}
         */
        copySync: function(intoPath, recursive, syncMode, resolveSymlink) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            if (!this._existsSync(resolveSymlink)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot copy path '" + this.getAbsolutePath() + "' because it does not exist.");
            }

            var copyPath = this._generateTargetPathSync(intoPath, resolveSymlink);
            this.ensurePathSync(intoPath);
            this._copySync(copyPath, recursive, syncMode, resolveSymlink);
            return copyPath;
        },

        //TODO BRN: add option for "preserve" See http://en.wikipedia.org/wiki/Cp_(Unix) for description.
        /**
         * Rules for DIRECTORY copy
         * 1) The intoPath must be a directory (or not created).
         * 2) If the intoPath does not exist, this function will attempt to create the intoPath.
         * 3) This will not copy files recursively unless the "recursive" option is set to true.
         * 4) This function will look in the intoPath for a path by the name of this directory
         * 4a) If a path by the name of this one does NOT exist, it will create a directory with this name. The
         * directory's contents will then be copied in to the newly created directory.
         * 4b) If a path by the name of this one exists, it will take one of the following actions based upon the
         * SyncMode
         *
         * SyncMode.MERGE_REPLACE
         * If the Path is a directory, this directory's contents will be copied in to the currently existing directory.
         * If the Path is a file, the file will be removed and this directory will be copied.
         *
         * SyncMode.MERGE_STOP
         * If the Path is a directory, this directory's contents will be copied in to the currently existing directory.
         * If the Path is a file, the file will be left alone and this directory will not be copied.
         *
         * SyncMode.REPLACE
         * If the Path is a directory, it will be removed and this directory will be copied.
         * If the Path is a file, it will be removed and this directory will be copied.
         *
         * SyncMode.STOP
         * The copy will be stopped and no action will be taken.
         *
         * @param {(string|Path)} intoPath
         * @param {(boolean|function(Throwable, Path=))=} recursive (defaults to true)
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {(boolean|function(Throwable, Path=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable, Path=)=} callback
         */
        copyDirectory: function(intoPath, recursive, syncMode, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            if (TypeUtil.isFunction(recursive)) {
                callback = recursive;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;
            var _copyPath = null;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot copy directory '" + _this.getAbsolutePath() + "' because it does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                            if (!error) {
                                if (isDirectory) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotADirectory", {}, "Cannot perform a directory copy on '" + _this.getAbsolutePath() + "' because it is " +
                                        "not a directory."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._generateTargetPath(intoPath, resolveSymlink, function(error, targetPath) {
                            _copyPath = targetPath;
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyDirectory(_copyPath, recursive, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        callback(error, _copyPath);
                    }
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {?boolean=} recursive (defaults to true)
         * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {?boolean=} resolveSymlink (defaults to false)
         * @return {Path}
         */
        copyDirectorySync: function(intoPath, recursive, syncMode, resolveSymlink) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            if (!this._existsSync(resolveSymlink)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot copy directory '" + this.getAbsolutePath() + "' because it does not exist.");
            }
            if (!this._isDirectorySync(resolveSymlink)) {
                throw new Exception("PathIsNotADirectory", {}, "Cannot perform a directory copy on '" + this.getAbsolutePath() + "' because it is not a" +
                    " directory");
            }

            var copyPath = this._generateTargetPathSync(intoPath, resolveSymlink);
            this.ensurePathSync(intoPath);
            this._copyDirectorySync(copyPath, recursive, syncMode);
            return copyPath;
        },

        /**
         * Rules for DIRECTORY copy CONTENTS
         * 1) The intoPath must be a directory (or not created).
         * 2) If the intoPath exists, this function will copy the CONTENTS of this path INTO the intoPath
         * 3) If the intoPath does not exist, this function will attempt to create the intoPath and then copy the contents.
         * 4) This will not copy files recursively unless the "recursive" option is set to true.
         * @param {(string|Path)} intoPath
         * @param {(boolean|function(Throwable=))=} recursive (defaults to true)
         * @param {(Path.SyncMode|function(Throwable=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {(boolean|function(Throwable=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable=)=} callback
         */
        copyDirectoryContents: function(intoPath, recursive, syncMode, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            if (TypeUtil.isFunction(recursive)) {
                callback = recursive;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot copy contents of directory '" + _this.getAbsolutePath() + "' " +
                                        "because it does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                            if (!error) {
                                if (isDirectory) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotADirectory", {}, "Cannot perform a directory contents copy on '" +
                                        _this.getAbsolutePath() + "' because it is not a directory."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyDirectoryContents(intoPath, recursive, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    callback(error);
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {?boolean=} recursive (defaults to true)
         * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {?boolean=} resolveSymlink (defaults to false)
         */
        copyDirectoryContentsSync: function(intoPath, recursive, syncMode, resolveSymlink) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            if (!this._existsSync(resolveSymlink)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot copy contents of directory '" + this.getAbsolutePath() + "' because it does " +
                    "not exist.");
            }
            if (!this._isDirectorySync(resolveSymlink)) {
                throw new Exception("PathIsNotADirectory", {}, "Cannot perform a directory contents copy on '" + this.getAbsolutePath() +
                    "' because it is not a directory.");
            }
            this.ensurePathSync(intoPath);
            this._copyDirectoryContentsSync(intoPath, recursive, syncMode);
        },

        //TODO BRN: add option for "preserve" See http://en.wikipedia.org/wiki/Cp_(Unix) for description.
        /**
         * Rules for FILE copy
         * 1) If the intoPath does not exist, this function will attempt to create the directory path.
         * 2) If the intoPath exists, this file will be copied INTO the existing path.
         * 3) The copyFile function will look in to the intoPath for a path by this file's name.
         * 4a) If the path does not exist, the file will be created and this file's contents will be copied in to the new
         * file.
         * 4b) If the path does exist, the fileCopy function will take one of the following actions based upon the SyncMode.
         *
         * SyncMode.MERGE_REPLACE
         * If the Path is a directory, the directory will be removed and this file will be copied.
         * If the Path is a file, the file's contents will be replace with this file's contents.
         *
         * SyncMode.MERGE_STOP
         * If the Path is a directory, this file will not be copied.
         * If the Path is a file, the file will be left alone and this file will not be copied.
         *
         * SyncMode.REPLACE
         * If the Path is a directory, it will be removed and this file will be copied.
         * If the Path is a file, it will be removed, a new file will be created, and this file's contents will be copied
         * to the new file.
         *
         * SyncMode.STOP
         * The copy will be stopped and no action will be taken.
         *
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {(boolean|function(Throwable, Path=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable, Path=)=} callback
         */
        copyFile: function(intoPath, syncMode, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;
            var _copyPath = null;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot copy file '" + _this.getAbsolutePath() + "' because it does " +
                                        "not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isFile(resolveSymlink, function(error, isFile) {
                            if (!error) {
                                if (isFile) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotAFile", {}, "Cannot perform a file copy on '" + _this.getAbsolutePath() +
                                        "' because it is not a file."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._generateTargetPath(intoPath, resolveSymlink, function(error, targetPath) {
                            _copyPath = targetPath;
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyFile(_copyPath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(error, _copyPath);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {?boolean=} resolveSymlink (defaults to false)
         * @return {Path}
         */
        copyFileSync: function(intoPath, syncMode, resolveSymlink) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            if (!this._existsSync(resolveSymlink)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot copy file '" + this.getAbsolutePath() + "' because it does not exist.");
            }
            if (!this._isFileSync(resolveSymlink)) {
                throw new Exception("PathIsNotAFile", {}, "Cannot perform a file copy on '" + this.getAbsolutePath() + "' because it is not " +
                    "a file.");
            }

            var copyPath = this._generateTargetPathSync(intoPath, resolveSymlink);
            this.ensurePathSync(intoPath);
            this._copyFileSync(copyPath, syncMode);
            return copyPath;
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {function(Throwable, Path=)=} callback
         */
        copySymlink: function(intoPath, syncMode, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;

            var _this = this;
            var _copyPath = null;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(false, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot copy symlink '" + _this.getAbsolutePath() + "' because it does " +
                                        "not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isSymlink(function(error, isSymlink) {
                            if (!error) {
                                if (isSymlink) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotASymlink", {}, "Cannot perform a symlink copy on '" + _this.getAbsolutePath() +
                                        "' because it is not a symlink."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._generateTargetPath(intoPath, false, function(error, targetPath) {
                            _copyPath = targetPath;
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copySymlink(_copyPath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                        Path.transactionSemaphore.release();
                        if (callback) {
                            if (!error) {
                                callback(error, _copyPath);
                            } else {
                                callback(error);
                            }
                        }
                    });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
         * @return {Path}
         */
        copySymlinkSync: function(intoPath, syncMode) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;

            if (!this._existsSync(false)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot copy symlink '" + this.getAbsolutePath() + "' because it does not exist.");
            }
            if (!this._isSymlinkSync()) {
                throw new Exception("PathIsNotASymlink", {}, "Cannot perform a symlink copy on '" + this.getAbsolutePath() + "' because it is not " +
                    "a symlink.");
            }

            var copyPath = this._generateTargetPathSync(intoPath, false);
            this.ensurePathSync(intoPath);
            this._copySymlinkSync(copyPath, syncMode);
            return copyPath;
        },

        /**
         * Rules for createDirectory
         * 1) If the directory already exists, it is NOT MODIFIED
         * @param {(boolean|function(Throwable, Path=))=} createParentDirectories (defaults to true)
         * @param {(string|function(Throwable, Path=))=} mode (defaults to '0777')
         * @param {function(Throwable, Path=)} callback
         */
        createDirectory: function(createParentDirectories, mode, callback) {
            if (TypeUtil.isFunction(mode)) {
                callback = mode;
            }
            if (TypeUtil.isFunction(createParentDirectories)) {
                callback = createParentDirectories;
            }
            createParentDirectories = TypeUtil.isBoolean(createParentDirectories) ? createParentDirectories : true;
            mode = TypeUtil.isString(mode) ? mode : '0777';

            var _this = this;

            Path.transactionSemaphore.acquire(function() {
                $if (function(flow) {
                        _this._exists(false, function(throwable, exists) {
                            if (!throwable) {
                                flow.assert(!exists);
                            } else {
                                flow.error(throwable);
                            }
                        });
                    },
                    $task(function(flow) {
                        _this._createDirectory(createParentDirectories, mode, function(error) {
                            flow.complete(error);
                        });
                    })
                ).$else(
                    $task(function(flow) {

                        // NOTE BRN: We check this to make sure that the given path did not exist already as a file.

                        _this._isDirectory(false, function(error, isDirectory) {
                            if (!error) {
                                if (!isDirectory) {
                                    flow.error(new Exception("PathIsNotADirectory", {}, "Could not create directory '" + _this.getAbsolutePath() +
                                        "' because it already exists and is not a directory."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    })
                ).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(null, this);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {?boolean=} createParentDirectories
         * @param {?string=} mode
         * @return {Path}
         */
        createDirectorySync: function(createParentDirectories, mode) {
            createParentDirectories = TypeUtil.isBoolean(createParentDirectories) ? createParentDirectories : true;
            mode = TypeUtil.isString(mode) ? mode : '0777';

            if (!this._existsSync(false)) {
                this._createDirectorySync(createParentDirectories, mode);
            } else if (!this._isDirectorySync(false)) {
                throw new Exception("PathAlreadyExists", {}, "Could not create directory '" + this.getAbsolutePath() + "' because it already exists " +
                    "and is not a directory.");
            }
            return this;
        },

        /**
         * Rules for createFile
         * 1) If the file already exists, it is NOT MODIFIED.
         * 2) If the path already exists and it is not a file, the function will throw an error.
         * @param {(boolean|function(Throwable, Path=))=} createParentDirectories (defaults to true)
         * @param {function(Throwable, Path=)=} callback
         * @returns {Promise}
         */
        createFile: function(createParentDirectories, callback) {
            if (TypeUtil.isFunction(createParentDirectories)) {
                callback = createParentDirectories;
            }
            createParentDirectories = TypeUtil.isBoolean(createParentDirectories) ? createParentDirectories : true;

            var _this       = this;
            var deferred    = Promises.deferred();
            deferred.callback(callback);

            Path.transactionSemaphore.acquire(function() {
                $if(function(flow) {
                        _this._exists(false, function(throwable, exists) {
                            if (!throwable) {
                                flow.assert(!exists);
                            } else {
                                flow.error(throwable);
                            }
                        });
                    },
                    $task(function(callback) {
                        _this._createFile(createParentDirectories, callback);
                    })
                ).$else(
                    // NOTE BRN: We check this to make sure that the given path did not exist already as a file.
                    function(flow) {
                        _this._isFile(false, function(error, isFile) {
                            if (!error) {
                                if (!isFile) {
                                    return flow.error(new Exception("PathAlreadyExists", {}, "Could not create file '" + _this.getAbsolutePath() +
                                        "' because it already exists and is not a file."));
                                }
                            }
                            flow.complete(error, _this);
                        });
                    }
                ).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (!error) {
                        deferred.resolve(_this);
                    } else {
                        deferred.reject(error);
                    }
                });
            });
            return deferred.promise();
        },

        /**
         * @param {?boolean=} createParentDirectories (defaults to true)
         */
        createFileSync: function(createParentDirectories) {
            createParentDirectories = TypeUtil.isBoolean(createParentDirectories) ? createParentDirectories : true;
            if (!this._existsSync(false)) {
                this._createFileSync(createParentDirectories);
            } else if (!this._isFileSync(false)) {
                throw new Exception("PathAlreadyExists", {}, "Could not create file '" + this.getAbsolutePath() + "' because it already exists " +
                    "and is not a file.");
            }
            return this;
        },

        //TODO BRN: Figure out how to integrate the file handle semaphore in to these stream functions.
        /**
         * @param {Object=} options
         * @return {ReadStream}
         */
        createReadStream: function(options) {
            return fs.createReadStream(this.getAbsolutePath(), options);
        },

        /**
         * @param {Object=} options
         * @return {WriteStream}
         */
        createWriteStream: function(options) {
            return fs.createWriteStream(this.getAbsolutePath(), options);
        },

        /**
         * @param {(boolean|function(Throwable=))=} recursive
         * @param {(boolean|function(Throwable=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable=)=} callback
         */
        delete: function(recursive, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(recursive)) {
                callback = recursive;
            }
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;
            Path.transactionSemaphore.acquire(function() {
                $if (function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                flow.assert(exists);
                            } else {
                                flow.error(throwable);
                            }
                        });
                    },
                    $task(function(flow) {
                        _this._delete(recursive, resolveSymlink, function(error) {
                            flow.complete(error);
                        });
                    })
                ).execute(function(error) {
                    Path.transactionSemaphore.release();
                    callback(error);
                });
            });
        },

        /**
         * @param {?boolean=} recursive
         * @param {?boolean=} resolveSymlink (defaults to false)
         */
        deleteSync: function(recursive, resolveSymlink) {
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            if (this._existsSync(resolveSymlink)) {
                this._deleteSync(recursive, resolveSymlink);
            }
        },

        /**
         * @param {(boolean|function(Throwable=))=} recursive (defaults to true)
         * @param {(boolean|function(Throwable=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable=)=} callback
         */
        deleteDirectory: function(recursive, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(recursive)) {
                callback = recursive;
            }
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;

            Path.transactionSemaphore.acquire(function() {
                $if (function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                flow.assert(exists);
                            } else {
                                flow.error(throwable);
                            }
                        });
                    },
                    $series([
                        $task(function(flow) {
                            _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                                if (!error) {
                                    if (isDirectory) {
                                        flow.complete();
                                    } else {
                                        flow.error(new Exception("PathIsNotADirectory", {}, "Cannot perform a directory delete on '" + _this.getAbsolutePath() +
                                            "' because it is not a directory."));
                                    }
                                } else {
                                    flow.error(error);
                                }
                            });
                        }),
                        $task(function(flow) {
                            _this._deleteDirectory(recursive, function(error) {
                                flow.complete(error);
                            });
                        })
                    ])
                ).execute(function(error) {
                    Path.transactionSemaphore.release();
                    callback(error);
                });
            });
        },

        /**
         * @param {boolean=} recursive
         * @param {boolean=} resolveSymlink (defaults to false)
         */
        deleteDirectorySync: function(recursive, resolveSymlink) {
            recursive = TypeUtil.isBoolean(recursive) ? recursive : true;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            if (this._existsSync(resolveSymlink)) {
                if (!this._isDirectorySync(resolveSymlink)) {
                    throw new Exception("PathIsNotADirectory", {}, "Cannot perform a directory delete on '" + this.getAbsolutePath() +
                        "' because it is not a directory.")
                }
                this._deleteDirectorySync(recursive);
            }
        },

        /**
         * @param {(boolean|function(Throwable=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable=)=} callback
         */
        deleteFile: function(resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            var _this = this;
            Path.transactionSemaphore.acquire(function() {
                $if (function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                flow.assert(exists);
                            } else {
                                flow.error(throwable);
                            }
                        });
                    },
                    $series([
                        $task(function(flow) {
                            _this._isFile(resolveSymlink, function(error, isFile) {
                                if (!error) {
                                    if (isFile) {
                                        flow.complete();
                                    } else {
                                        flow.error(new Exception("PathIsNotAFile", {}, "Cannot perform a file delete on '" + _this.getAbsolutePath() + "' because it " +
                                            "is not a file."));
                                    }
                                } else {
                                    flow.error(error);
                                }
                            });
                        }),
                        $task(function(flow) {
                            _this._deleteFile(function(error) {
                                flow.complete(error);
                            });
                        })
                    ])
                ).execute(function(error) {
                    Path.transactionSemaphore.release();
                    callback(error);
                });
            })
        },

        /**
         * @param {boolean=} resolveSymlink (defaults to false)
         */
        deleteFileSync: function(resolveSymlink) {
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            if (this._existsSync(resolveSymlink)) {
                if (!this._isFileSync(resolveSymlink)) {
                    throw new Exception("PathIsNotAFile", {}, "Cannot perform a file delete on '" + this.getAbsolutePath() + "' because it is not " +
                        "a file.");
                }
                this._deleteFileSync();
            }
        },

        /**
         * @param {function(Throwable=)} callback
         */
        deleteSymlink: function(callback) {
            var _this = this;
            Path.transactionSemaphore.acquire(function() {
                $if (function(flow) {
                        _this._exists(false, function(throwable, exists) {
                            if (!throwable) {
                                flow.assert(exists);
                            } else {
                                flow.error(throwable);
                            }
                        });
                    },
                    $series([
                        $task(function(flow) {
                            _this._isSymlink(function(error, isSymlink) {
                                if (!error) {
                                    if (isSymlink) {
                                        flow.complete();
                                    } else {
                                        flow.error(new Exception("PathIsNotASymlink", {}, "Cannot perform a symlink delete on '" + _this.getAbsolutePath() + "' because it " +
                                            "is not a symlink."));
                                    }
                                } else {
                                    flow.error(error);
                                }
                            });
                        }),
                        $task(function(flow) {
                            _this._deleteSymlink(function(error) {
                                flow.complete(error);
                            });
                        })
                    ])
                ).execute(function(error) {
                    Path.transactionSemaphore.release();
                    callback(error);
                });
            })
        },

        /**
         *
         */
        deleteSymlinkSync: function() {
            if (this._existsSync(false)) {
                if (!this._isSymlinkSync()) {
                    throw new Exception("PathIsNotASymlink", {}, "Cannot perform a symlink delete on '" + this.getAbsolutePath() + "' because it is not " +
                        "a symlink.");
                }
                this._deleteSymlinkSync();
            }
        },

        /**
         * @param {(boolean|function(boolean))} resolveSymlink (defaults to false)
         * @param {?function(Throwable, boolean=)=} callback
         */
        exists: function(resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            var _this = this;
            Path.transactionSemaphore.acquire(function() {
                _this._exists(resolveSymlink, function(throwable, result) {
                    Path.transactionSemaphore.release();
                    callback(throwable, result);
                })
            });
        },

        /**
         * @param {?boolean=} resolveSymlink (defaults to false)
         * @return {boolean}
         */
        existsSync: function(resolveSymlink) {
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            return this._existsSync(resolveSymlink);
        },

        //TODO BRN: Should this return false if the path does not exist, or should it throw an error like it does now?
        /**
         * @param {(boolean|function(Throwable, boolean=))} resolveSymlink (defaults to false)
         * @param {function(Throwable, boolean=)=} callback
         */
        isDirectory: function(resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            var _this = this;
            Path.transactionSemaphore.acquire(function() {
                _this._isDirectory(resolveSymlink, function(error, result) {
                    Path.transactionSemaphore.release();
                    callback(error, result);
                })
            });
        },

        //TODO BRN: Should this return false if the path does not exist, or should it throw an error like it does now?
        /**
         * @param {?boolean=} resolveSymlink (defaults to false)
         * @return {boolean}
         */
        isDirectorySync: function(resolveSymlink) {
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            return this._isDirectorySync(resolveSymlink);
        },

        /**
         * @param {(boolean|function(Throwable, boolean=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable, boolean=)=} callback
         */
        isDirectoryEmpty: function(resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            var _this = this;
            var _isEmpty = null;
            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot check if directory '" + _this.getAbsolutePath() + "' is empty because it " +
                                        "does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                            if (!error) {
                                if (isDirectory) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotADirectory", {}, "Cannot perform an empty directory check on '" + _this.getAbsolutePath() +
                                        "' because it is not a directory."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isDirectoryEmpty(function(error, isEmpty) {
                            if (!error) {
                                _isEmpty = isEmpty;
                                flow.complete();
                            } else {
                                flow.error(error);
                            }
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    callback(error, _isEmpty);
                });
            });
        },

        /**
         * @param {boolean=} resolveSymlink (defaults to false)
         * @return {boolean}
         */
        isDirectoryEmptySync: function(resolveSymlink) {
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            if (!this._existsSync(resolveSymlink)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot check if directory '" + this.getAbsolutePath() + "' is empty because it does " +
                    "not exist.");
            }
            if (!this._isDirectorySync(resolveSymlink)) {
                throw new Exception("PathIsNotADirectory", {}, "Cannot perform an empty directory check on '" + this.getAbsolutePath() +
                    "' because it is not a directory.");
            }
            return this._isDirectoryEmptySync(resolveSymlink);
        },

        /**
         * @param {(boolean|function(Throwable, boolean=))} resolveSymlink (defaults to false)
         * @param {function(Throwable, boolean=)=} callback
         */
        isFile: function(resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            var _this = this;
            Path.transactionSemaphore.acquire(function() {
                _this._isFile(resolveSymlink, function(error, result) {
                    Path.transactionSemaphore.release();
                    callback(error, result);
                })
            });
        },

        /**
         * @param {?boolean=} resolveSymlink (defaults to false)
         * @return {boolean}
         */
        isFileSync: function(resolveSymlink) {
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            return this._isFileSync(resolveSymlink);
        },

        /**
         * @param {function(Throwable, boolean=)} callback
         */
        isSymlink: function(callback) {
            var _this = this;
            Path.transactionSemaphore.acquire(function() {
                _this._isSymlink(function(error, result) {
                    Path.transactionSemaphore.release();
                    callback(error, result);
                })
            });
        },

        /**
         * @return {boolean}
         */
        isSymlinkSync: function() {
            return this._isSymlinkSync();
        },

        /**
         * If an argument is not a string or a Path it is ignored.
         * @param {Array.<(string|Path)>} paths
         * @return {Path}
         */
        joinPaths: function(paths) {
            var pathStrings = [this.getGivenPath()];
            for (var i = 0, size = paths.length; i < size; i++) {
                var _path = paths[i];
                if (Class.doesExtend(_path, Path)) {
                    pathStrings.push(_path.getGivenPath());
                } else if (TypeUtil.isString(_path)) {
                    pathStrings.push(_path);
                }
            }
            return new Path(path.join.apply(path, pathStrings));
        },

        //TODO BRN: Handle the case where a move is across a network or through a symlink, need to copy instead of rename
        /**
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {(boolean|function(Throwable, Path=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable, Path=)=} callback
         */
        move: function(intoPath, syncMode, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;
            var _movePath = null;
            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot move path '" + _this.getAbsolutePath() + "' because it does " +
                                        "not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._generateTargetPath(intoPath, resolveSymlink, function(error, targetPath) {
                            _movePath = targetPath;
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._move(_movePath, syncMode, resolveSymlink, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(error, _movePath);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {Path.SyncMode=} syncMode
         * @param {boolean=} resolveSymlink (defaults to false)
         * @return {Path}
         */
        moveSync: function(intoPath, syncMode, resolveSymlink) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            if (!this._existsSync(resolveSymlink)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot move path '" + this.getAbsolutePath() + "' because it does not exist.")
            }

            var movePath = this._generateTargetPathSync(intoPath, resolveSymlink);
            this.ensurePathSync(intoPath);
            this._moveSync(movePath, syncMode, resolveSymlink);
            return movePath;
        },

        /**
         * Rules for DIRECTORY move
         * 1) The intoPath must be a directory (or not created).
         * 2) If the intoPath does not exist, this function will attempt to create the intoPath.
         * 3) This function will look in the intoPath for a directory by the name of this directory
         * 3a) If a directory by the name of this one exists and overwrite is true, it will attempt to merge this directory's
         * contents with that one
         * 3b) If a directory by the name of this one exists and overwrite is false, it will not attempt a move.
         * 3c) If a directory by the name of this one does NOT exist, it will create a directory with this name. The
         * directory's contents will then be moved in to the newly created directory.
         * 6) This will not copy files recursively unless the "recursive" option is set to true.
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {(boolean|function(Throwable, Path=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable, Path=)=} callback
         */
        moveDirectory: function(intoPath, syncMode, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;
            var _movePath = null;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot move directory '" + _this.getAbsolutePath() + "' because it " +
                                        "does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                            if (!error) {
                                if (isDirectory) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotADirectory", {}, "Cannot perform a directory move on '" + _this.getAbsolutePath() +
                                        "' because it is not a directory."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._generateTargetPath(intoPath, resolveSymlink, function(error, targetPath) {
                            _movePath = targetPath;
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._moveDirectory(_movePath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(error, _movePath);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {Path.SyncMode=} syncMode
         * @param {boolean=} resolveSymlink (defaults to false)
         * @return {Path}
         */
        moveDirectorySync: function(intoPath, syncMode, resolveSymlink) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            if (!this._existsSync(resolveSymlink)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot move directory '" + this.getAbsolutePath() + "' because it does not exist.");
            }
            if (!this._isDirectorySync(resolveSymlink)) {
                throw new Exception("PathIsNotADirectory", {}, "Cannot perform a directory move on '" + this.getAbsolutePath() + "' because it is not a" +
                    " directory");
            }

            var movePath = this._generateTargetPathSync(intoPath, resolveSymlink);
            this.ensurePathSync(intoPath);
            this._moveDirectorySync(movePath, syncMode);
            return movePath;
        },

        /**
         * Rules for DIRECTORY move CONTENTS
         * 1) The intoPath must be a directory (or not created).
         * 2) If the intoPath exists, this function will move the CONTENTS of this path INTO the intoPath
         * 3) If the intoPath does not exist, this function will attempt to create the intoPath and then move the contents.
         * 4) This will always move files recursively
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable=))=} syncMode (defaults to Path.SyncMode)
         * @param {(boolean|function(Throwable=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable=)=} callback
         */
        moveDirectoryContents: function(intoPath, syncMode, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot move contents of directory '" + _this.getAbsolutePath() + "' " +
                                        "because it does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                            if (!error) {
                                if (isDirectory) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotADirectory", {}, "Cannot perform a directory contents move on '" +
                                        _this.getAbsolutePath() + "' because it is not a directory."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._moveDirectoryContents(intoPath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    callback(error);
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {boolean=} resolveSymlink (defaults to false)
         */
        moveDirectoryContentsSync: function(intoPath, syncMode, resolveSymlink) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            if (!this._existsSync(resolveSymlink)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot move contents of directory '" + this.getAbsolutePath() + "' because it does " +
                    "not exist.");
            }
            if (!this._isDirectorySync(resolveSymlink)) {
                throw new Exception("PathIsNotADirectory", {}, "Cannot perform a directory contents move on '" + this.getAbsolutePath() +
                    "' because it is not a directory.");
            }
            this.ensurePathSync(intoPath);
            this._moveDirectoryContentsSync(intoPath, syncMode);
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to false)
         * @param {(boolean|function(Throwable, Path=))=} resolveSymlink (defaults to false)
         * @param {function(Throwable, Path=)=} callback
         */
        moveFile: function(intoPath, syncMode, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;
            var _movePath = null;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot move file '" + _this.getAbsolutePath() + "' because it does " +
                                        "not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isFile(resolveSymlink, function(error, isFile) {
                            if (!error) {
                                if (isFile) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotAFile", {}, "Cannot perform a file move on '" + _this.getAbsolutePath() + "' because it " +
                                        "is not a file."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._generateTargetPath(intoPath, resolveSymlink, function(error, targetPath) {
                            _movePath = targetPath;
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._moveFile(_movePath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(error, _movePath);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {boolean=} resolveSymlink (defaults to false)
         * @return {Path}
         */
        moveFileSync: function(intoPath, syncMode, resolveSymlink) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            if (!this._existsSync(resolveSymlink)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot move file '" + this.getAbsolutePath() + "' because it does" +
                    "not exist.");
            }
            if (!this._isFileSync(resolveSymlink)) {
                 throw new Exception("PathIsNotAFile", {}, "Cannot perform a file move on '" + this.getAbsolutePath() + "' because it " +
                     "is not a file.");
            }

            var movePath = this._generateTargetPathSync(intoPath, resolveSymlink);
            this.ensurePathSync(intoPath);
            this._moveFileSync(movePath, syncMode);
            return movePath;
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to false)
         * @param {function(Throwable, Path=)=} callback
         */
        moveSymlink: function(intoPath, syncMode, callback) {
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;

            var _this = this;
            var _movePath = new Path(intoPath.getAbsolutePath() + path.sep + this.getName());

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(false, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot move symlink '" + _this.getAbsolutePath() + "' because it does " +
                                        "not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isSymlink(function(error, isSymlink) {
                            if (!error) {
                                if (isSymlink) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotASymlink", {}, "Cannot perform a symlink move on '" + _this.getAbsolutePath() + "' because it " +
                                        "is not a symlink."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._moveSymlink(_movePath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(error, _movePath);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
         * @return {Path}
         */
        moveSymlinkSync: function(intoPath, syncMode) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;

            var movePath = new Path(intoPath.getAbsolutePath() + path.sep + this.getName());
            if (!this._existsSync(false)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot move symlink '" + this.getAbsolutePath() + "' because it does not exist.");
            }
            if (!this._isSymlinkSync()) {
                throw new Exception("PathIsNotASymlink", {}, "Cannot perform a symlink move on '" + this.getAbsolutePath() + "' because it " +
                    "is not a symlink.");
            }
            this.ensurePathSync(intoPath);
            this._moveSymlinkSync(movePath, syncMode);
            return movePath;
        },

        /**
         * @param {(boolean|function(Throwable, Array.<Path>=))=} resolveSymlink (defaults to true)
         * @param {function(Throwable, Array.<Path>=)=} callback
         */
        readDirectory: function(resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : true;
            var _this = this;
            var dirPaths = null;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot read directory '" + _this.getAbsolutePath() + "' because it " +
                                        "does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                            if (!error) {
                                if (isDirectory) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotADirectory", {}, "Cannot read directory '" + _this.getAbsolutePath() + "' because it " +
                                        "is not a directory."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._readDirectory(function(error, _dirPaths) {
                            dirPaths = _dirPaths;
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(null, dirPaths);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {boolean=} resolveSymlink (defaults to true)
         * @return {Array<Path>}
         */
        readDirectorySync: function(resolveSymlink) {
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : true;
            if (this._existsSync(resolveSymlink)) {
                if (this._isDirectorySync(resolveSymlink)) {
                    return this._readDirectorySync();
                } else {
                    throw new Exception("PathIsNotADirectory", {}, "Cannot read directory '" + this.getAbsolutePath() + "' because it is not a " +
                        "directory.");
                }
            } else {
                throw new Exception("PathDoesNotExist", {}, "Cannot ready directory '" + this.getAbsolutePath() + "' because it does not exist.");
            }
        },

        /**
         * @param {(string|function(Throwable, *=))} encoding
         * @param {(boolean|function(Throwable, *=))=} resolveSymlink (defaults to true)
         * @param {function(Throwable, *=)=} callback
         */
        readFile: function(encoding, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(encoding)) {
                callback = encoding;
            }
            encoding = TypeUtil.isString(encoding) ? encoding : undefined;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : true;

            var _this = this;
            var _data = null;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot read file '" + _this.getAbsolutePath() + "' because it " +
                                        "does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isFile(resolveSymlink, function(error, isFile) {
                            if (!error) {
                                if (isFile) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotAFile", {}, "Cannot read file '" + _this.getAbsolutePath() + "' because it " +
                                        "is not a file."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._readFile(encoding, function(error, data) {
                            _data = data;
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        callback(error, _data);
                    }
                });
            });
        },

        /**
         * @param {?string=} encoding
         * @param {?boolean=} resolveSymlink (defaults to true)
         */
        readFileSync: function(encoding, resolveSymlink) {
            encoding = TypeUtil.isString(encoding) ? encoding : undefined;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : true;
            if (this._existsSync(resolveSymlink)) {
                if (this._isFileSync(resolveSymlink)) {
                    return this._readFileSync(encoding);
                } else {
                    throw new Exception("PathIsNotAFil", {}, "Cannot read file '" + this.getAbsolutePath() + "' because it is not a " +
                        "file.");
                }
            } else {
                throw new Exception("PathDoesNotExist", {}, "Cannot read file '" + this.getAbsolutePath() + "' because it does not exist.");
            }
        },

        /**
         * If an argument is not a string or a Path it is ignored.
         * @param {Array.<(string|Path)>} paths
         * @return {Path}
         */
        resolvePaths: function(paths) {
            var pathStrings = [this.getGivenPath()];
            for (var i = 0, size = paths.length; i < size; i++) {
                var _path = paths[i];
                if (Class.doesExtend(_path, Path)) {
                    pathStrings.push(_path.getGivenPath());
                } else if (TypeUtil.isString(_path)) {
                    pathStrings.push(_path);
                }
            }
            return new Path(path.resolve.apply(path, pathStrings));
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {function(Throwable, Path=)=} callback
         */
        symlinkInto: function(intoPath, syncMode, callback) {
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;

            var _this = this;
            var _symlinkPath = new Path(intoPath.getAbsolutePath() + path.sep + this.getName());
            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(false, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot symlink path '" + _this.getAbsolutePath() + "' because it does " +
                                        "not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._symlinkTo(_symlinkPath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(null, _symlinkPath);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {?Path.SyncMode=} syncMode
         * @return {Path}
         */
        symlinkIntoSync: function(intoPath, syncMode) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;

            var symlinkPath = new Path(intoPath.getAbsolutePath() + path.sep + this.getName());
            if (!this._existsSync(false)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot symlink path '" + this.getAbsolutePath() + "' because it does not exist.")
            }
            this.ensurePathSync(intoPath);
            this._symlinkToSync(symlinkPath, syncMode);
            return symlinkPath;
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {function(Throwable, Path=)=} callback
         */
        symlinkDirectoryInto: function(intoPath, syncMode, callback) {
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;

            var _this = this;
            var _symlinkPath = new Path(intoPath.getAbsolutePath() + path.sep + this.getName());

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(false, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot symlink directory '" + _this.getAbsolutePath() + "' because it " +
                                        "does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isDirectory(false,function(error, isDirectory) {
                            if (!error) {
                                if (isDirectory) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotADirectory", {}, "Cannot perform a directory symlink on '" + _this.getAbsolutePath() +
                                        "' because it is not a directory."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._symlinkDirectoryTo(_symlinkPath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(error, _symlinkPath);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
         * @return {Path}
         */
        symlinkDirectoryIntoSync: function(intoPath, syncMode) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;

            var symlinkPath = new Path(intoPath.getAbsolutePath() + path.sep + this.getName());
            if (!this._existsSync(false)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot symlink directory '" + this.getAbsolutePath() + "' because it does not exist.");
            }
            if (!this._isDirectorySync(false)) {
                throw new Exception("PathIsNotADirectory", {}, "Cannot perform a directory symlink on '" + this.getAbsolutePath() + "' because it is not a" +
                    " directory");
            }
            this.ensurePathSync(intoPath);
            this._symlinkDirectoryToSync(symlinkPath, syncMode);
            return symlinkPath;
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {function(Throwable, Path=)=} callback
         */
        symlinkDirectoryContentsInto: function(intoPath, syncMode, callback) {
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;

            var _this = this;

            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(false, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot symlink contents of directory '" + _this.getAbsolutePath() + "' " +
                                        "because the directory does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isDirectory(false, function(error, isDirectory) {
                            if (!error) {
                                if (isDirectory) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotADirectory", {}, "Cannot symlink contents of directory '" +
                                        _this.getAbsolutePath() + "' because it is not a directory."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._symlinkDirectoryContentsInto(intoPath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    callback(error);
                });
            });
        },

        /**
         * @param {(string|Path)} directoryPath
         * @param {(string|Path)} intoPath
         * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
         * @return {Path}
         */
        symlinkDirectoryContentsIntoSync: function(directoryPath, intoPath, syncMode) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            if (!this._existsSync(false)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot symlink contents of directory '" + this.getAbsolutePath() + "' because the " +
                    "directory does not exist.");
            }
            if (!this._isDirectorySync(false)) {
                throw new Exception("PathIsNotADirectory", {}, "Cannot symlink contents of directory '" + this.getAbsolutePath() +
                    "' because it is not a directory.");
            }
            this.ensurePathSync(intoPath);
            this._symlinkDirectoryContentsIntoSync(intoPath, syncMode);
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
         * @param {function(Throwable, Path=)=} callback
         */
        symlinkFileInto: function(intoPath, syncMode, callback) {
            if (TypeUtil.isFunction(syncMode)) {
                callback = syncMode;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;

            var _this = this;
            var _symlinkPath = new Path(intoPath.getAbsolutePath() + path.sep + this.getName());
            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(false, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot symlink file '" + _this.getAbsolutePath() + "' because it " +
                                        "does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isFile(false, function(error, isFile) {
                            if (!error) {
                                if (isFile) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotAFile", {}, "Cannot symlink file '" + _this.getAbsolutePath() + "' because " +
                                        "it is not a file."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this.ensurePath(intoPath, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._symlinkFileTo(_symlinkPath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(error, _symlinkPath);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(string|Path)} intoPath
         * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
         * @return {Path}
         */
        symlinkFileIntoSync: function(intoPath, syncMode) {
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            syncMode = TypeUtil.isString(syncMode) ? syncMode : Path.SyncMode.STOP;
            var symlinkPath = new Path(intoPath.getAbsolutePath() + path.sep + this.getName());
            if (!this._existsSync(false)) {
                throw new Exception("PathDoesNotExist", {}, "Cannot symlink file '" + this.getAbsolutePath() + "' because it does" +
                    "not exist.");
            }
            if (!this._isFileSync(false)) {
                throw new Exception("PathIsNotAFile", {}, "Cannot symlink file '" + this.getAbsolutePath() + "' because it " +
                    "is not a file.");
            }
            this.ensurePathSync(intoPath);
            this._symlinkFileToSync(symlinkPath, syncMode);
            return symlinkPath;
        },

        /**
         * @param {string} data
         * @param {(string|function(Throwable=))=} encoding (defaults to 'utf8')
         * @param {(boolean|function(Throwable=))=} resolveSymlink (defaults to true)
         * @param {function(Throwable=)=} callback
         */
        writeFile: function(data, encoding, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            if (TypeUtil.isFunction(encoding)) {
                callback = encoding;
                encoding = 'utf8';
            }
            encoding = TypeUtil.isString(encoding) ? encoding : 'utf8';
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : true;

            var _this = this;
            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(throwable, exists) {
                            if (!throwable) {
                                if (!exists) {
                                    flow.error(new Exception("PathDoesNotExist", {}, "Cannot write to file '" + _this.getAbsolutePath() + "' because it " +
                                        "does not exist."));
                                } else {
                                    flow.complete();
                                }
                            } else {
                                flow.error(throwable);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isFile(resolveSymlink, function(error, isFile) {
                            if (!error) {
                                if (isFile) {
                                    flow.complete();
                                } else {
                                    flow.error(new Exception("PathIsNotAFile", {}, "Cannot write to file '" + _this.getAbsolutePath() + "' because " +
                                        "it is not a file."));
                                }
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._writeFile(data, encoding, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        callback(error);
                    }
                });
            });
        },

        /**
         * @param {string} data
         * @param {?string} encoding
         * @param {?boolean=} resolveSymlink (defaults to true)
         */
        writeFileSync: function(data, encoding, resolveSymlink) {
            encoding = TypeUtil.isString(encoding) ? encoding : 'utf8';
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : true;

            if (this._existsSync(resolveSymlink)) {
                if (this._isFileSync(resolveSymlink)) {
                    this._writeFileSync(data, encoding);
                } else {
                    throw new Exception("PathIsNotAFile", {}, "Cannot write to file '" + this.getAbsolutePath() + "' because " +
                    "it is not a file.");
                }
            } else {
                throw new Exception("PathDoesNotExist", {}, "Cannot write to file '" + this.getAbsolutePath() + "' because it " +
                    "does not exist.");
            }
        },


        //-------------------------------------------------------------------------------
        // Private Methods
        //-------------------------------------------------------------------------------

        /**
         * @param {Path} copyPath
         * @param {boolean} recursive (defaults to true)
         * @param {Path.SyncMode} syncMode (defaults to Path.SyncMode.STOP)
         * @param {boolean} resolveSymlink
         * @param {function(Throwable=)=} callback
         */
        _copy: function(copyPath, recursive, syncMode, resolveSymlink, callback) {
            var _this = this;
            $if (function(flow) {
                    _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._copyDirectory(copyPath, recursive, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf (function(flow) {
                    _this._isFile(resolveSymlink, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._copyFile(copyPath, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf (function(flow) {
                    _this._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._copySymlink(copyPath, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$else (
                $task(function(flow) {
                    flow.error(new Exception("PathIsUnknownType", {}, "Cannot copy path '" + _this.getAbsolutePath() + "' because it is an " +
                        "unknown type."));
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         * @param {boolean} resolveSymlink
         */
        _copySync: function(copyPath, recursive, syncMode, resolveSymlink) {
            if (this._isDirectorySync(resolveSymlink)) {
                this._copyDirectorySync(copyPath, recursive, syncMode);
            } else if (this._isFileSync(resolveSymlink)) {
                this._copyFileSync(copyPath, syncMode);
            } else if (this._isSymlinkSync()) {
                this._copySymlinkSync(copyPath, syncMode);
            }else {
                throw new Exception("PathIsUnknownType", {}, "Cannot copy path '" + this.getAbsolutePath() + "' because it is an unknown type.");
            }
        },

        /**
         * @private
         * @param {Path} intoPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         * @param {boolean} resolveSymlink
         * @param {function(Throwable=)} callback
         */
        _copyContents: function(intoPath, recursive, syncMode, resolveSymlink, callback) {
            var _this = this;
            var copyPath = null;
            $if (function(flow) {
                    _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._copyDirectoryContents(intoPath, recursive, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf(function(flow) {
                    _this._isFile(resolveSymlink, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        _this._generateTargetPath(intoPath, resolveSymlink, function(error, targetPath) {
                            copyPath = targetPath;
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyFile(copyPath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf (function(flow) {
                    _this._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        _this._generateTargetPath(intoPath, resolveSymlink, function(error, targetPath) {
                            copyPath = targetPath;
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copySymlink(copyPath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$else (
                $task(function(flow) {
                    flow.error(new Exception("PathIsUnknownType", {}, "Cannot copy path '" + _this.getAbsolutePath() + "' because it is an " +
                        "unknown type."));
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _copyDirectory: function(copyPath, recursive, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    copyPath._exists(false, function(throwable, exists) {
                        if (!throwable) {
                            flow.assert(exists);
                        } else {
                            flow.error(throwable);
                        }
                    });
                },
                $task(function(flow) {
                    switch (syncMode) {
                        case Path.SyncMode.MERGE_REPLACE:
                            _this._copyDirectoryMergeReplace(copyPath, recursive, syncMode, function(error) {
                                flow.complete(error);
                            });
                            break;
                        case Path.SyncMode.MERGE_STOP:
                            _this._copyDirectoryMergeStop(copyPath, recursive, syncMode, function(error) {
                                flow.complete(error);
                            });
                            break;
                        case Path.SyncMode.REPLACE:
                            _this._copyDirectoryReplace(copyPath, recursive, syncMode, function(error) {
                                flow.complete(error);
                            });
                            break;
                        default:
                            flow.complete();
                    }
                })
            ).$else(
                $task(function(flow) {
                    copyPath._createDirectory(true, "0777", function(error) {
                        if (!error) {
                            _this._copyDirectoryContents(copyPath, recursive, syncMode, function(error) {
                                flow.complete(error);
                            });
                        } else {
                            flow.error(error);
                        }
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         */
        _copyDirectorySync: function(copyPath, recursive, syncMode) {
            if (copyPath._existsSync(false)) {

                //NOTE BRN: Do nothing in the STOP case

                switch (syncMode) {
                    case Path.SyncMode.MERGE_REPLACE:
                        this._copyDirectoryMergeReplaceSync(copyPath, recursive, syncMode);
                        break;
                    case Path.SyncMode.MERGE_STOP:
                        this._copyDirectoryMergeStopSync(copyPath, recursive, syncMode);
                        break;
                    case Path.SyncMode.REPLACE:
                        this._copyDirectoryReplaceSync(copyPath, recursive, syncMode);
                        break;
                }
            } else {
                copyPath._createDirectorySync(true, "0777");
                this._copyDirectoryContentsSync(copyPath, recursive, syncMode);
            }
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _copyDirectoryMergeReplace: function(copyPath, recursive, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    copyPath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._copyDirectoryContents(copyPath, recursive, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf(function(flow) {
                    copyPath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteFile(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        copyPath._createDirectory(true, "0777", function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyDirectoryContents(copyPath, recursive, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    copyPath._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteSymlink(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        copyPath._createDirectory(true, "0777", function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyDirectoryContents(copyPath, recursive, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         */
        _copyDirectoryMergeReplaceSync: function(copyPath, recursive, syncMode) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (copyPath._isDirectorySync(false)) {
                this._copyDirectoryContentsSync(copyPath, recursive, syncMode);
            } else if (copyPath._isFileSync(false)) {
                copyPath._deleteFileSync();
                copyPath._createDirectorySync(true, "0777");
                this._copyDirectoryContentsSync(copyPath, recursive, syncMode);
            } else if (copyPath._isSymlinkSync()) {
                copyPath._deleteSymlinkSync();
                copyPath._createDirectorySync(true, "0777");
                this._copyDirectoryContentsSync(copyPath, recursive, syncMode);
            }
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _copyDirectoryMergeStop: function(copyPath, recursive, syncMode, callback) {
            var _this = this;
            copyPath._isDirectory(false, function(error, isDirectory) {
                if (!error) {
                    if (isDirectory) {
                        _this._copyDirectoryContents(copyPath, recursive, syncMode, callback);
                    } else {
                        callback();
                    }
                } else {
                    callback(error);
                }
            });
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         */
        _copyDirectoryMergeStopSync: function(copyPath, recursive, syncMode) {

            //NOTE BRN: Do nothing if the copyPath is a file we don't recognize the type (symlink)

            if (copyPath._isDirectorySync(false)) {
                this._copyDirectoryContentsSync(copyPath, recursive, syncMode);
            }
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _copyDirectoryReplace: function(copyPath, recursive, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    copyPath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        copyPath._createDirectory(true, "0777", function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyDirectoryContents(copyPath, recursive, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    copyPath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteFile(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        copyPath._createDirectory(true, "0777", function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyDirectoryContents(copyPath, recursive, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    copyPath._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteSymlink(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        copyPath._createDirectory(true, "0777", function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyDirectoryContents(copyPath, recursive, syncMode, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         */
        _copyDirectoryReplaceSync: function(copyPath, recursive, syncMode) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (copyPath._isDirectorySync(false)) {
                copyPath._deleteDirectorySync(true);
                copyPath._createDirectorySync(true, "0777");
                this._copyDirectoryContentsSync(copyPath, recursive, syncMode);
            } else if (copyPath._isFileSync(false)) {
                copyPath._deleteFileSync();
                copyPath._createDirectorySync(true, "0777");
                this._copyDirectoryContentsSync(copyPath, recursive, syncMode);
            } else if (copyPath._isSymlinkSync()) {
                copyPath._deleteSymlinkSync();
                copyPath._createDirectorySync(true, "0777");
                this._copyDirectoryContentsSync(copyPath, recursive, syncMode);
            }
        },

        /**
         * @private
         * @param {Path} intoPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _copyDirectoryContents: function(intoPath, recursive, syncMode, callback) {
            var _this = this;
            var childPathArray = [];
            $series([
                $task(function(flow) {
                    _this._readDirectory(function(error, pathArray) {
                        if (!error) {
                            childPathArray = pathArray;
                            flow.complete();
                        } else {
                            flow.error(error);
                        }
                    });
                }),
                $task(function(flow) {
                    $forEachParallel(childPathArray, function(flow, childPath) {
                        var copyPath = new Path(intoPath.getAbsolutePath() + path.sep + childPath.getName());
                        $if (function(flow) {
                                childPath._isDirectory(false, function(error, isDirectory) {
                                    if (!error) {
                                        flow.assert(isDirectory);
                                    } else {
                                        flow.error(error);
                                    }
                                });
                            },
                            $task(function(flow) {
                                if (recursive) {
                                    childPath._copyDirectory(copyPath, recursive, syncMode, function(error) {
                                        flow.complete(error);
                                    });
                                } else {
                                    flow.complete();
                                }
                            })
                        ).$elseIf(function(flow) {
                                childPath._isFile(false, function(error, isFile) {
                                    if (!error) {
                                        flow.assert(isFile);
                                    } else {
                                        flow.error(error);
                                    }
                                });
                            },
                            $task(function(flow) {
                                childPath._copyFile(copyPath, syncMode, function(error) {
                                    flow.complete(error);
                                });
                            })
                        ).$elseIf(function(flow) {
                                childPath._isSymlink(function(error, isSymlink) {
                                    if (!error) {
                                        flow.assert(isSymlink);
                                    } else {
                                        flow.error(error);
                                    }
                                });
                            },
                            $task(function(flow) {
                                childPath._copySymlink(copyPath, syncMode, function(error) {
                                    flow.complete(error);
                                });
                            })
                        ).execute(function(error) {
                            flow.complete(error);
                        });
                    }).execute(function(error) {
                        flow.complete(error);
                    });
                })
            ]).execute(callback);
        },

        /**
         * @private
         * @param {Path} intoPath
         * @param {boolean} recursive
         * @param {Path.SyncMode} syncMode
         */
        _copyDirectoryContentsSync: function(intoPath, recursive, syncMode) {
            var childPathArray = this._readDirectorySync();
            childPathArray.forEach(function(childPath) {
                var copyPath = new Path(intoPath.getAbsolutePath() + path.sep + childPath.getName());
                if (childPath._isDirectorySync(false) && recursive) {
                    childPath._copyDirectorySync(copyPath, recursive, syncMode);
                } else if (childPath._isFileSync(false)) {
                    childPath._copyFileSync(copyPath, syncMode);
                } else if (childPath._isSymlinkSync()) {
                    childPath._copySymlinkSync(copyPath, syncMode);
                }
            });
        },

        //TODO BRN: add option for "preserve" See http://en.wikipedia.org/wiki/Cp_(Unix) for description.
        /**
         * @private
         * @param {Path} copyPath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _copyFile: function(copyPath, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    copyPath._exists(false, function(throwable, exists) {
                        if (!throwable) {
                            flow.assert(exists);
                        } else {
                            flow.error(throwable);
                        }
                    });
                },
                $task(function(flow) {
                    switch (syncMode) {
                        case Path.SyncMode.MERGE_REPLACE:
                            _this._copyFileMergeReplace(copyPath, function(error) {
                                flow.complete(error);
                            });
                            break;
                        case Path.SyncMode.REPLACE:
                            _this._copyFileReplace(copyPath, function(error) {
                                flow.complete(error);
                            });
                            break;
                        default:
                            flow.complete();
                    }
                })
            ).$else(
                $series([
                    $task(function(flow) {
                        copyPath._createFile(false, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyFileContents(copyPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {Path.SyncMode} syncMode
         */
        _copyFileSync: function(copyPath, syncMode) {
            if (copyPath._existsSync(false)) {
                //NOTE BRN: Do nothing in the STOP case AND the MERGE_STOP

                switch (syncMode) {
                    case Path.SyncMode.MERGE_REPLACE:
                        this._copyFileMergeReplaceSync(copyPath);
                        break;
                    case Path.SyncMode.REPLACE:
                        this._copyFileReplaceSync(copyPath);
                        break;
                }

            } else {
                copyPath._createFileSync(false);
                this._copyFileContentsSync(copyPath);
            }
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {function(Throwable=)} callback
         */
        _copyFileMergeReplace: function(copyPath, callback) {
            var _this = this;
            $if (function(flow) {
                    copyPath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        copyPath._createFile(false, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyFileContents(copyPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    copyPath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $task(function(flow) {
                    _this._copyFileContents(copyPath, function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf(function(flow) {
                    copyPath._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteSymlink(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        copyPath._createFile(false, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyFileContents(copyPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         */
        _copyFileMergeReplaceSync: function(copyPath) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (copyPath._isDirectorySync(false)) {
                copyPath._deleteDirectorySync(true);
                copyPath._createFileSync(false);
                this._copyFileContentsSync(copyPath);
            } else if (copyPath._isFileSync(false)) {
                this._copyFileContentsSync(copyPath);
            } else if (copyPath._isSymlinkSync()) {
                copyPath._deleteSymlinkSync();
                copyPath._createFileSync(false);
                this._copyFileContentsSync(copyPath);
            }
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {function(Throwable=)} callback
         */
        _copyFileReplace: function(copyPath, callback) {
            var _this = this;
            $if (function(flow) {
                    copyPath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        copyPath._createFile(false, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyFileContents(copyPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    copyPath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteFile(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        copyPath._createFile(false, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyFileContents(copyPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    copyPath._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteSymlink(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        copyPath._createFile(false, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._copyFileContents(copyPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         */
        _copyFileReplaceSync: function(copyPath) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (copyPath._isDirectorySync(false)) {
                copyPath._deleteDirectorySync(true);
                copyPath._createFileSync(false);
                this._copyFileContentsSync(copyPath);
            } else if (copyPath._isFileSync(false)) {
                copyPath._deleteFileSync();
                copyPath._createFileSync(false);
                this._copyFileContentsSync(copyPath);
            } else if (copyPath._isSymlinkSync()) {
                copyPath._deleteSymlinkSync();
                copyPath._createFileSync(false);
                this._copyFileContentsSync(copyPath);
            }
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {function(Throwable=)} callback
         */
        _copyFileContents: function(copyPath, callback) {
            var _this = this;
            var readStream = this.createReadStream();
            var writeStream = copyPath.createWriteStream();

            //TODO BRN: Not sure if this counts as a file handle. Need to look in to this.

            Path.fileHandleSemaphore.acquire(function() {
                var cbCalled = false;

                var done = function(error) {
                    readStream.removeAllListeners();
                    writeStream.removeAllListeners();
                    Path.fileHandleSemaphore.release();
                    if (!cbCalled) {
                        callback(error);
                        cbCalled = true;
                    }
                };
                writeStream.on('close', function(error) {
                    done();
                });
                readStream.on('error', function(error) {
                    done(error);
                });
                writeStream.on('error', function(error) {
                    done(error);
                });
                readStream.pipe(writeStream);
            });
        },

        /**
         * @private
         * @param {Path} copyPath
         */
        _copyFileContentsSync: function(copyPath) {
            var BUF_LENGTH = 64 * 1024;
            var buffer = new Buffer(BUF_LENGTH);
            var fdRead = fs.openSync(this.getAbsolutePath(), 'r');
            var fdWrite = fs.openSync(copyPath.getAbsolutePath(), 'w');
            var bytesRead = 1;
            var position = 0;
            while (bytesRead > 0) {
                bytesRead = fs.readSync(fdRead, buffer, 0, BUF_LENGTH, position);
                fs.writeSync(fdWrite, buffer, 0, bytesRead);
                position += bytesRead;
            }
            fs.closeSync(fdRead);
            fs.closeSync(fdWrite);
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _copySymlink: function(copyPath, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    copyPath._exists(false, function(throwable, exists) {
                        if (!throwable) {
                            flow.assert(exists);
                        } else {
                            flow.error(throwable);
                        }
                    });
                },
                $task(function(flow) {
                    switch (syncMode) {
                        case Path.SyncMode.MERGE_REPLACE:
                            _this._copySymlinkMergeReplace(copyPath, function(error) {
                                flow.complete(error);
                            });
                            break;
                        case Path.SyncMode.REPLACE:
                            _this._copySymlinkReplace(copyPath, function(error) {
                                flow.complete(error);
                            });
                            break;
                        default:
                            flow.complete();
                    }
                })
            ).$else(
                $task(function(flow) {
                    _this._resolveSymlinks(function(error, resolvedPath) {
                        if (!error) {
                            resolvedPath._symlink(copyPath, function(error) {
                                flow.complete(error);
                            });
                        } else {
                            flow.error(error);
                        }
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {Path.SyncMode} syncMode
         */
        _copySymlinkSync: function(copyPath, syncMode) {
            if (copyPath._existsSync(false)) {

                //NOTE BRN: Do nothing in the STOP case AND the MERGE_STOP

                switch (syncMode) {
                    case Path.SyncMode.MERGE_REPLACE:
                        this._copySymlinkMergeReplaceSync(copyPath);
                        break;
                    case Path.SyncMode.REPLACE:
                        this._copySymlinkReplaceSync(copyPath);
                        break;
                }
            } else {
                this._resolveSymlinksSync()._symlinkSync(copyPath);
            }
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {function(Throwable=)} callback
         */
        _copySymlinkMergeReplace: function(copyPath, callback) {
            var _this = this;
            $if (function(flow) {
                    copyPath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._resolveSymlinks(function(error, resolvedPath) {
                            if (!error) {
                                resolvedPath._symlink(copyPath, function(error) {
                                    flow.complete(error);
                                });
                            } else {
                                flow.error(error);
                            }
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    copyPath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteFile(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        _this._resolveSymlinks(function(error, resolvedPath) {
                            if (!error) {
                                resolvedPath._symlink(copyPath, function(error) {
                                    flow.complete(error);
                                });
                            } else {
                                flow.error(error);
                            }
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    copyPath._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteSymlink(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        _this._resolveSymlinks(function(error, resolvedPath) {
                            if (!error) {
                                resolvedPath._symlink(copyPath, function(error) {
                                    flow.complete(error);
                                });
                            } else {
                                flow.error(error);
                            }
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         */
        _copySymlinkMergeReplaceSync: function(copyPath) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (copyPath._isDirectorySync(false)) {
                copyPath._deleteDirectorySync(true);
                this._resolveSymlinksSync()._symlinkSync(copyPath);
            } else if (copyPath._isFileSync(false)) {
                copyPath._deleteFileSync();
                this._resolveSymlinksSync()._symlinkSync(copyPath);
            } else if (copyPath._isSymlinkSync()) {
                copyPath._deleteSymlinkSync();
                this._resolveSymlinksSync()._symlinkSync(copyPath);
            }
        },

        /**
         * @private
         * @param {Path} copyPath
         * @param {function(Throwable=)} callback
         */
        _copySymlinkReplace: function(copyPath, callback) {
            var _this = this;
            $if (function(flow) {
                    copyPath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._resolveSymlinks(function(error, resolvedPath) {
                            if (!error) {
                                resolvedPath._symlink(copyPath, function(error) {
                                    flow.complete(error);
                                });
                            } else {
                                flow.error(error);
                            }
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    copyPath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteFile(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._resolveSymlinks(function(error, resolvedPath) {
                            if (!error) {
                                resolvedPath._symlink(copyPath, function(error) {
                                    flow.complete(error);
                                });
                            } else {
                                flow.error(error);
                            }
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    copyPath._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        copyPath._deleteSymlink(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._resolveSymlinks(function(error, resolvedPath) {
                            if (!error) {
                                resolvedPath._symlink(copyPath, function(error) {
                                    flow.complete(error);
                                });
                            } else {
                                flow.error(error);
                            }
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} copyPath
         */
        _copySymlinkReplaceSync: function(copyPath) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (copyPath._isDirectorySync(false)) {
                copyPath._deleteDirectorySync(true);
                this._resolveSymlinksSync()._symlinkSync(copyPath);
            } else if (copyPath._isFileSync(false)) {
                copyPath._deleteFileSync();
                this._resolveSymlinksSync()._symlinkSync(copyPath);
            } else if (copyPath._isSymlinkSync()) {
                copyPath._deleteSymlinkSync();
                this._resolveSymlinksSync()._symlinkSync(copyPath);
            }
        },

        /**
         * @private
         * @param {boolean} createParentDirectories
         * @param {string} mode
         * @param {function(Throwable=)} callback
         */
        _createDirectory: function(createParentDirectories, mode, callback) {
            var _this = this;
            $series([
                $task(function(flow) {
                    if (createParentDirectories) {
                        _this.ensureParentDirectories(mode, function(error) {
                            flow.complete(error);
                        });
                    } else {
                        flow.complete();
                    }
                }),
                $task(function(flow) {
                    Path.fileHandleSemaphore.acquire(function() {
                        fs.mkdir(_this.getAbsolutePath(), mode, $traceWithError(function(error) {
                            Path.fileHandleSemaphore.release();
                            if (!error) {
                                flow.complete();
                            } else {
                                flow.error(new Exception("FsError", {}, "An error occurred in the fs module", [error]));
                            }
                        }));
                    });
                })
            ]).execute(callback);
        },

        /**
         * @private
         * @param {boolean} createParentDirectories
         * @param {string} mode
         */
        _createDirectorySync: function(createParentDirectories, mode) {
            if (createParentDirectories) {
                this.ensureParentDirectoriesSync(mode);
            }
            fs.mkdirSync(this.getAbsolutePath(), mode);
        },

        /**
         * If the file already exists, it is NOT MODIFIED
         * @private
         * @param {boolean} createParentDirectories (defaults to true)
         * @param {function(Throwable=)} callback
         */
        _createFile: function(createParentDirectories, callback) {
            var _this = this;
            $series([
               $task(function(flow) {
                    if (createParentDirectories) {
                        _this.ensureParentDirectories("0777", function(error) {
                            flow.complete(error);
                        });
                    } else {
                        flow.complete();
                    }
                }),
                $task(function(flow) {
                    Path.fileHandleSemaphore.acquire(function() {
                        fs.writeFile(_this.getAbsolutePath(), "", $traceWithError(function(error) {
                            Path.fileHandleSemaphore.release();
                            if (!error) {
                                flow.complete();
                            } else {
                                flow.error(new Exception("FsError", {}, "An error occurred in the fs module", [error]));
                            }
                        }));
                    });
                })
            ]).execute(callback);
        },

        /**
         * @private
         * @param {boolean} createParentDirectories
         */
        _createFileSync: function(createParentDirectories) {
            if (createParentDirectories) {
                this.ensureParentDirectoriesSync("0777");
            }
            fs.writeFileSync(this.getAbsolutePath(), "");
        },

        /**
         * @param {boolean} recursive
         * @param {boolean} resolveSymlink
         * @param {function(Throwable=)} callback
         */
        _delete: function(recursive, resolveSymlink, callback) {
            var _this = this;
            $if (function(flow) {
                    _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._deleteDirectory(recursive, function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf(function(flow) {
                    _this._isFile(resolveSymlink, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._deleteFile(function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf(function(flow) {
                    _this._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            if (isSymlink) {
                                flow.assert(isSymlink);
                            } else {
                                flow.error(new Exception("PathIsUnknownType", {}, "Cannot delete path '" + _this.getAbsolutePath() + "' because it is an " +
                                    "unknown type."));
                            }
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._deleteSymlink(function(error) {
                        flow.complete(error);
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {boolean} recursive
         * @param {boolean} resolveSymlink
         */
        _deleteSync: function(recursive, resolveSymlink) {
            if (this._isDirectorySync(resolveSymlink)) {
                this._deleteDirectorySync(recursive);
            } else if (this._isFileSync(resolveSymlink)) {
                this._deleteFileSync();
            } else if (this._isSymlinkSync()) {
                this._deleteSymlinkSync();
            } else {
                throw new Exception("PathIsUnknownType", {}, "Cannot delete path '" + this.getAbsolutePath() + "' because it is an unknown type.");
            }
        },

        /**
         * @private
         * @param {boolean} recursive
         * @param {function(Throwable=)} callback
         */
        _deleteDirectory: function(recursive, callback) {
            var _this = this;
            var childPathArray = [];
            $series([
                $task(function(flow) {
                    _this._readDirectory(function(error, pathArray) {
                        if (!error) {
                            childPathArray = pathArray;
                            flow.complete();
                        } else {
                            flow.error(error);
                        }
                    });
                }),
                $task(function(flow) {
                    if (childPathArray.length > 0) {
                        if (recursive) {
                            $forEachParallel(childPathArray, function(flow, childPath) {

                                // TODO BRN: If "resolveSymlink" is true, do we want to continue to follow ALL symlinks, or
                                // should we only follow the first one?
                                // NOTE BRN: by setting resolveSymlink to "false" here we are only following the first
                                // symlink.

                                childPath._delete(recursive, false, function(error) {
                                    flow.complete(error);
                                });
                            }).execute([], function(error) {
                                flow.complete(error);
                            });
                        } else {
                            flow.error(new Exception("DirectoryNotEmpty", {}, "Cannot delete a non-empty directory. Must delete recursively to " +
                                "delete a non-empty directory."));
                        }
                    } else {
                        flow.complete();
                    }
                }),
                $task(function(flow) {
                    _this._removeDirectoryOrRemoveSymlinkedDirectory(function(error) {
                        flow.complete(error);
                    });
                })
            ]).execute(callback);
        },

        /**
         * @private
         * @param {boolean} recursive
         */
        _deleteDirectorySync: function(recursive) {
            var childPathArray = this._readDirectorySync();
            if (childPathArray.length > 0) {
                if (recursive) {
                    childPathArray.forEach(function(childPath) {
                        childPath._deleteSync(recursive);
                    });
                } else {
                    throw new Exception("DirectoryNotEmpty", {}, "Cannot delete a non-empty directory. Must delete recursively to delete a " +
                        "non-empty directory.");
                }
            }
            this._removeDirectoryOrRemoveSymlinkedDirectorySync();
        },

        /**
         * @private
         * @param {function(Throwable=)} callback
         */
        _deleteFile: function(callback) {
            this._unlinkFileOrUnlinkSymlinkedFile(callback);
        },

        /**
         * @private
         */
        _deleteFileSync: function() {
            this._unlinkFileOrUnlinkSymlinkedFileSync();
        },

        /**
         * @private
         * @param {function(Throwable=)} callback
         */
        _deleteSymlink: function(callback) {
            Path.fileHandleSemaphore.acquire(function() {
                fs.unlink(_this.getAbsolutePath(), $traceWithError(function(error) {
                    Path.fileHandleSemaphore.release();
                    if (error) {
                        error = new Exception("FsError", {}, "An error occurred in the fs module.", [error]);
                    }
                    callback(error);
                }));
            });
        },

        /**
         * @private
         */
        _deleteSymlinkSync: function() {
            fs.unlinkSync(this.getAbsolutePath());
        },

        /**
         * @private
         * @param {boolean} resolveSymlink
         * @param {function(Throwable, boolean=)} callback
         */
        _exists: function(resolveSymlink, callback) {

            var _this = this;

            // NOTE BRN: We use lstat sync here to determine if the file exists because fs.exists will return false if
            // there is a symlink but it points to a file/dir that no longer exists.
            // http://stackoverflow.com/questions/14193926/in-node-js-cannot-get-rid-of-a-bad-symlink

            Path.fileHandleSemaphore.acquire(function() {
                fs.lstat(_this.getAbsolutePath(), $traceWithError(function(error, stats) {
                    Path.fileHandleSemaphore.release();
                    if (error) {
                        if (error.code === "ENOENT") {
                            callback(null, false);
                        } else {
                            callback(error);
                        }
                    } else {
                        if (stats.isSymbolicLink() && resolveSymlink) {
                            _this._readSymlink(function(error, pointedLinkPath) {
                                if (!error) {
                                    pointedLinkPath._exists(false, callback);
                                } else {
                                    callback(error);
                                }
                            });
                        } else {
                            callback(null, true);
                        }
                    }
                }));
            });
        },

        /**
         * @private
         * @param {boolean} resolveSymlink
         * @return {boolean}
         */
        _existsSync: function(resolveSymlink) {
            try {
                // Query the entry
                var stats = fs.lstatSync(this.getAbsolutePath());
                if (stats.isSymbolicLink() && resolveSymlink) {
                    var pointedLinkPath = this._readSymlinkSync();
                    return pointedLinkPath._existsSync(false);
                } else {
                    return true;
                }
            } catch(error) {
                return false;
            }
        },

        /**
         * @private
         * @param {Path} intoPath
         * @param {boolean} resolveSymlink
         * @param {function(Throwable, Path=)} callback
         */
        _generateTargetPath: function(intoPath, resolveSymlink, callback) {
            var _this = this;
            this._isSymlink(function(error, isSymlink) {
                if (!error) {
                    if (isSymlink && resolveSymlink) {
                        _this._readSymlink(function(error, symlinkedPath) {
                            symlinkedPath._generateTargetPath(intoPath, resolveSymlink, callback);
                        });
                    } else {
                        callback(null, new Path(intoPath.getAbsolutePath() + path.sep + _this.getName()));
                    }
                } else {
                    callback(error);
                }
            });
        },

        /**
         * @private
         * @param {Path} intoPath
         * @param {boolean} resolveSymlink
         * @return {Path}
         */
        _generateTargetPathSync: function(intoPath, resolveSymlink) {
            if (this._isSymlinkSync() && resolveSymlink) {
                var symlinkedPath = this._readSymlinkSync();
                return symlinkedPath._generateTargetPathSync(intoPath, resolveSymlink);
            } else {
                return new Path(intoPath.getAbsolutePath() + path.sep + this.getName());
            }
        },

        /**
         * @param {boolean} resolveSymlink
         * @param {function(Throwable, boolean=)} callback
         */
        _isDirectory: function(resolveSymlink, callback) {
            var _this = this;
            Path.fileHandleSemaphore.acquire(function() {
                fs.lstat(_this.getAbsolutePath(), $traceWithError(function(error, stats) {
                    Path.fileHandleSemaphore.release();
                    if (!error) {
                        if (stats.isSymbolicLink() && resolveSymlink) {
                            _this._readSymlink(function(throwable, symlinkedPath) {
                                if (!throwable) {
                                    symlinkedPath._isDirectory(false, callback);
                                } else {
                                    callback(throwable);
                                }
                            });
                        } else {
                            callback(undefined, stats.isDirectory());
                        }
                    } else {
                        callback(new Exception("FsError", {}, "An error occurred in the fs module", [error]));
                    }
                }));
            });
        },

        /**
         * @private
         * @param {boolean} resolveSymlink
         * @return {boolean}
         */
        _isDirectorySync: function(resolveSymlink) {
            var stats = fs.lstatSync(this.getAbsolutePath());
            if (stats.isSymbolicLink() && resolveSymlink) {
                var symlinkedPath = this._readSymlinkSync();
                return symlinkedPath._isDirectorySync(false);
            } else {
                return stats.isDirectory();
            }
        },

        /**
         * @private
         * @param {function(Throwable, boolean=)} callback
         */
        _isDirectoryEmpty: function(callback) {
            this._readDirectory(function(error, pathArray) {
                if (!error) {
                    callback(null, (pathArray.length === 0))
                } else {
                    callback(error);
                }
            });
        },

        /**
         * @private
         * @return {boolean}
         */
        _isDirectoryEmptySync: function() {
            var pathArray = this._readDirectorySync();
            return (pathArray.length === 0);
        },

        /**
         * @private
         * @param {boolean} resolveSymlink
         * @param {function(Throwable, boolean=)} callback
         */
        _isFile: function(resolveSymlink, callback) {
            var _this = this;
            Path.fileHandleSemaphore.acquire(function() {
                fs.lstat(_this.getAbsolutePath(), $traceWithError(function(error, stats) {
                    Path.fileHandleSemaphore.release();
                    if (error) {
                        callback(new Exception("FsError", {}, "An error occurred in the fs module", [error]));
                    } else {
                        if (stats.isSymbolicLink() && resolveSymlink) {
                            _this._readSymlink(function(error, symlinkedPath) {
                                if (!error) {
                                    symlinkedPath._isFile(false, callback);
                                } else {
                                    callback(error);
                                }
                            });
                        } else {
                            callback(null, stats.isFile());
                        }
                    }
                }));
            });
        },

        /**
         * @private
         * @param {boolean} resolveSymlink
         */
        _isFileSync: function(resolveSymlink) {
            var stats = fs.lstatSync(this.getAbsolutePath());
            if (stats.isSymbolicLink() && resolveSymlink) {
                var symlinkedPath = this._readSymlinkSync();
                return symlinkedPath._isFileSync(false);
            } else {
                return stats.isFile();
            }
        },

        /**
         * @private
         * @param {function(Throwable, boolean=)} callback
         */
        _isSymlink: function(callback) {
            var _this = this;
            Path.fileHandleSemaphore.acquire(function() {
                fs.lstat(_this.getAbsolutePath(), $traceWithError(function(error, stats) {
                    Path.fileHandleSemaphore.release();
                    if (error) {
                        callback(new Exception("FsError", "An error occurred in the fs module.", [error]), false);
                    } else {
                        callback(null, stats.isSymbolicLink());
                    }
                }));
            });
        },

        /**
         * @private
         * @return {boolean}
         */
        _isSymlinkSync: function() {
            var stats = fs.lstatSync(this.getAbsolutePath());
            return stats.isSymbolicLink();
        },

        /**
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode (defaults to Path.SyncMode.STOP)
         * @param {boolean} resolveSymlink
         * @param {function(Throwable=)} callback
         */
        _move: function(movePath, syncMode, resolveSymlink, callback) {
            var _this = this;
            $if (function(flow) {
                    _this._isDirectory(resolveSymlink, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._moveDirectory(movePath, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf (function(flow) {
                    _this._isFile(resolveSymlink, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._moveFile(movePath, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf (function(flow) {
                    _this._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._moveSymlink(movePath, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$else (
                $task(function(flow) {
                    flow.error(new Exception("PathIsUnknownType", {}, "Cannot move path '" + _this.getAbsolutePath() + "' because it is an " +
                        "unknown type."));
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         * @param {boolean} resolveSymlink
         */
        _moveSync: function(movePath, syncMode, resolveSymlink) {
            if (this._isDirectorySync(resolveSymlink)) {
                this._moveDirectorySync(movePath, syncMode);
            } else if (this._isFileSync(resolveSymlink)) {
                this._moveFileSync(movePath, syncMode);
            } else if (this._isSymlinkSync()) {
                this._moveSymlinkSync(movePath, syncMode);
            } else {
                throw new Exception("PathIsUnknownType", {}, "Cannot move path '" + this.getAbsolutePath() + "' because it is an unknown type.");
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _moveDirectory: function(movePath, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    movePath._exists(false, function(throwable, exists) {
                        if (!throwable) {
                            flow.assert(exists);
                        } else {
                            flow.error(throwable);
                        }
                    });
                },
                $task(function(flow) {
                    switch (syncMode) {
                        case Path.SyncMode.MERGE_REPLACE:
                            _this._moveDirectoryMergeReplace(movePath, syncMode, function(error) {
                                flow.complete(error);
                            });
                            break;
                        case Path.SyncMode.MERGE_STOP:
                            _this._moveDirectoryMergeStop(movePath, syncMode, function(error) {
                                flow.complete(error);
                            });
                            break;
                        case Path.SyncMode.REPLACE:
                            _this._moveDirectoryReplace(movePath, syncMode, function(error) {
                                flow.complete(error);
                            });
                            break;
                        default:
                            flow.complete();
                    }
                })
            ).$else(
                $task(function(flow) {
                    _this._renameDirectoryOrRenameSymlinkedDirectory(movePath, function(error) {
                        flow.complete(error);
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         */
        _moveDirectorySync: function(movePath, recursive, syncMode) {
            if (movePath._existsSync(false)) {

                //NOTE BRN: Do nothing in the STOP case

                switch (syncMode) {
                    case Path.SyncMode.MERGE_REPLACE:
                        this._moveDirectoryMergeReplaceSync(movePath, syncMode);
                        break;
                    case Path.SyncMode.MERGE_STOP:
                        this._moveDirectoryMergeStopSync(movePath, syncMode);
                        break;
                    case Path.SyncMode.REPLACE:
                        this._moveDirectoryReplaceSync(movePath, syncMode);
                        break;
                }
            } else {
                this._renameDirectoryOrRenameSymlinkedDirectorySync(movePath);
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _moveDirectoryMergeReplace: function(movePath, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    movePath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._moveDirectoryContents(movePath, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf(function(flow) {
                    movePath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteFile(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameDirectoryOrRenameSymlinkedDirectory(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isSymlink(function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteSymlink(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameDirectoryOrRenameSymlinkedDirectory(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         */
        _moveDirectoryMergeReplaceSync: function(movePath, syncMode) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (movePath._isDirectorySync(false)) {
                this._moveDirectoryContentsSync(movePath, syncMode);
            } else if (movePath._isFileSync(false)) {
                movePath._deleteFileSync();
                this._renameDirectoryOrRenameSymlinkedDirectorySync(movePath);
            } else if (movePath.isSymlinkSync()) {
                movePath._deleteSymlinkSync();
                this._renameDirectoryOrRenameSymlinkedDirectorySync(movePath);
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _moveDirectoryMergeStop: function(movePath, syncMode, callback) {
            var _this = this;
            movePath._isDirectory(false, function(error, isDirectory) {
                if (!error) {
                    if (isDirectory) {
                        _this._moveDirectoryContents(movePath, syncMode, callback);
                    } else {
                        callback();
                    }
                } else {
                    callback(error);
                }
            });
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         */
        _moveDirectoryMergeStopSync: function(movePath, syncMode) {

            //NOTE BRN: Do nothing if the copyPath is a file we don't recognize the type (symlink)

            if (movePath.isDirectorySync(false)) {
                this._moveDirectoryContentsSync(movePath, syncMode);
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _moveDirectoryReplace: function(movePath, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    movePath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameDirectoryOrRenameSymlinkedDirectory(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteFile(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        _this._renameDirectoryOrRenameSymlinkedDirectory(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteSymlink(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        _this._renameDirectoryOrRenameSymlinkedDirectory(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         */
        _moveDirectoryReplaceSync: function(movePath, syncMode) {

            //NOTE BRN: Do nothing if we don't recognize the type

            if (movePath._isDirectorySync(false)) {
                movePath._deleteDirectorySync(true);
                this._renameDirectoryOrRenameSymlinkedDirectorySync(movePath);
            } else if (movePath._isFileSync(false)) {
                movePath._deleteFileSync();
                this._renameDirectoryOrRenameSymlinkedDirectorySync(movePath);
            } else if (movePath._isSymlinkSync()) {
                movePath._deleteSymlinkSync();
                this._renameDirectoryOrRenameSymlinkedDirectorySync(movePath);
            }
        },

        /**
         * @private
         * @param {Path} intoPath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _moveDirectoryContents: function(intoPath, syncMode, callback) {
            var _this = this;
            var childPathArray = [];
            $series([
                $task(function(flow) {
                    _this._readDirectory(function(error, pathArray) {
                        if (!error) {
                            childPathArray = pathArray;
                            flow.complete();
                        } else {
                            flow.error(error);
                        }
                    });
                }),
                $task(function(flow) {
                    $forEachParallel(childPathArray, function(flow, childPath) {
                        var movePath = new Path(intoPath.getAbsolutePath() + path.sep + childPath.getName());
                        childPath._move(movePath, syncMode, false, function(error) {
                            flow.complete(error);
                        });
                    }).execute(function(error) {
                        flow.complete(error);
                    });
                })
            ]).execute(callback);
        },

        /**
         * @private
         * @param {Path} intoPath
         * @param {Path.SyncMode} syncMode
         */
        _moveDirectoryContentsSync: function(intoPath, syncMode) {
            var childPathArray = intoPath._readDirectorySync();
            childPathArray.forEach(function(childPath) {
                var movePath = new Path(intoPath.getAbsolutePath() + path.sep + childPath.getName());
                childPath._moveSync(movePath, syncMode, false);
            });
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _moveFile: function(movePath, syncMode, callback) {
            var _this = this;
            $if (function(flow) {

                    //TODO BRN: If the path we're targeting is a symlink and resolveSymlink is true, should we be trying to
                    //move the file in place of the file that the symlink points to? or the symlink itself?

                    movePath._exists(false, function(throwable, exists) {
                        if (!throwable) {
                            flow.assert(exists);
                        } else {
                            flow.error(throwable);
                        }
                    });
                },
                $task(function(flow) {
                    switch (syncMode) {
                        case Path.SyncMode.MERGE_REPLACE:
                            _this._moveFileMergeReplace(movePath, function(error) {
                                flow.complete(error);
                            });
                            break;
                        case Path.SyncMode.REPLACE:
                            _this._moveFileReplace(movePath, function(error) {
                                flow.complete(error);
                            });
                            break;
                        default:
                            flow.complete();
                    }
                })
            ).$else(
                $task(function(flow) {
                    _this._renameFileOrRenameSymlinkedFile(movePath, function(error) {
                        flow.complete(error);
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         */
        _moveFileSync: function(movePath, syncMode) {
            if (movePath._existsSync(false)) {

                //NOTE BRN: Do nothing in the STOP case AND the MERGE_STOP

                switch (syncMode) {
                    case Path.SyncMode.MERGE_REPLACE:
                        this._moveFileMergeReplaceSync(movePath);
                        break;
                    case Path.SyncMode.REPLACE:
                        this._moveFileReplaceSync(movePath);
                        break;
                }
            } else {
                this._renameFileOrRenameSymlinkedFileSync(movePath);
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {function(Throwable=)} callback
         */
        _moveFileMergeReplace: function(movePath, callback) {
            var _this = this;
            $if (function(flow) {
                    movePath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameFileOrRenameSymlinkedFile(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteFile(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameFileOrRenameSymlinkedFile(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isSymlink(function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteSymlink(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameFileOrRenameSymlinkedFile(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         */
        _moveFileMergeReplaceSync: function(movePath) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (movePath._isDirectorySync(false)) {
                movePath._deleteDirectorySync(true);
                this._renameFileOrRenameSymlinkedFileSync(movePath);
            } else if (movePath._isFileSync(false)) {
                movePath._deleteFileSync();
                this._renameFileOrRenameSymlinkedFileSync(movePath);
            } else if (movePath._isSymlinkSync()) {
                movePath._deleteSymlinkSync();
                this._renameFileOrRenameSymlinkedFileSync(movePath);
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {function(Throwable=)} callback
         */
        _moveFileReplace: function(movePath, callback) {
            var _this = this;
            $if (function(flow) {
                    movePath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameFileOrRenameSymlinkedFile(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteFile(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameFileOrRenameSymlinkedFile(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isSymlink(function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteSymlink(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameFileOrRenameSymlinkedFile(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         */
        _moveFileReplaceSync: function(movePath) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (movePath._isDirectorySync(false)) {
                movePath._deleteDirectorySync(true);
                this._renameFileOrRenameSymlinkedFileSync(movePath);
            } else if (movePath._isFileSync(false)) {
                movePath._deleteFileSync();
                this._renameFileOrRenameSymlinkedFileSync(movePath);
            } else if (movePath._isSymlinkSync()) {
                movePath._deleteFileSync();
                this._renameFileOrRenameSymlinkedFileSync(movePath);
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _moveSymlink: function(movePath, syncMode, callback) {
            var _this = this;
            $if (function(flow) {

                    //TODO BRN: If the path we're targeting is a symlink and resolveSymlink is true, should we be trying to
                    //move the file in place of the file that the symlink points to? or the symlink itself?

                    movePath._exists(false, function(throwable, exists) {
                        if (!throwable) {
                            flow.assert(exists);
                        } else {
                            flow.error(throwable);
                        }
                    });
                },
                $task(function(flow) {
                    switch (syncMode) {
                        case Path.SyncMode.MERGE_REPLACE:
                            _this._moveSymlinkMergeReplace(movePath, function(error) {
                                flow.complete(error);
                            });
                            break;
                        case Path.SyncMode.REPLACE:
                            _this._moveSymlinkReplace(movePath, function(error) {
                                flow.complete(error);
                            });
                            break;
                        default:
                            flow.complete();
                    }
                })
            ).$else(
                $task(function(flow) {
                    _this._renameSymlink(movePath, function(error) {
                        flow.complete(error);
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {Path.SyncMode} syncMode
         */
        _moveSymlinkSync: function(movePath, syncMode) {
            if (movePath._existsSync(false)) {

                //NOTE BRN: Do nothing in the STOP case AND the MERGE_STOP

                switch (syncMode) {
                    case Path.SyncMode.MERGE_REPLACE:
                        this._moveSymlinkMergeReplaceSync(movePath);
                        break;
                    case Path.SyncMode.REPLACE:
                        this._moveSymlinkReplaceSync(movePath);
                        break;
                }
            } else {
                this._renameSymlinkSync(movePath);
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {function(Throwable=)} callback
         */
        _moveSymlinkMergeReplace: function(movePath, callback) {
            var _this = this;
            $if (function(flow) {
                    movePath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameSymlink(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteFile(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameSymlink(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isSymlink(function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteSymlink(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameSymlink(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         */
        _moveSymlinkMergeReplaceSync: function(movePath) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (movePath._isDirectorySync(false)) {
                movePath._deleteDirectorySync(true);
                this._renameSymlinkSync(movePath);
            } else if (movePath._isFileSync(false)) {
                movePath._deleteFileSync();
                this._renameSymlinkSync(movePath);
            } else if (movePath._isSymlinkSync()) {
                movePath._deleteSymlinkSync();
                this._renameSymlinkSync(movePath);
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {function(Throwable=)} callback
         */
        _moveSymlinkReplace: function(movePath, callback) {
            var _this = this;
            $if (function(flow) {
                    movePath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameSymlink(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteFile(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameSymlink(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    movePath._isSymlink(function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        movePath._deleteSymlink(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._renameSymlink(movePath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         */
        _moveSymlinkReplaceSync: function(movePath) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (movePath._isDirectorySync(false)) {
                movePath._deleteDirectorySync(true);
                this._renameSymlinkSync(movePath);
            } else if (movePath._isFileSync(false)) {
                movePath._deleteFileSync();
                this._renameSymlinkSync(movePath);
            } else if (movePath._isSymlinkSync()) {
                movePath._deleteFileSync();
                this._renameSymlinkSync(movePath);
            }
        },

        /**
         * @private
         * @param {function(Throwable, Array.<Path>=)} callback
         */
        _readDirectory: function(callback) {
            var _this = this;
            Path.fileHandleSemaphore.acquire(function() {
                fs.readdir(_this.getAbsolutePath(), $traceWithError(function(error, files) {
                    Path.fileHandleSemaphore.release();
                    if (!error) {
                        var pathArray = [];
                        files.forEach(function(name) {
                            var childPathString = _this.getAbsolutePath() + path.sep + name;
                            pathArray.push(new Path(childPathString));
                        });
                        callback(null, pathArray);
                    } else {
                        callback(new Exception("FsError", {}, "An error occurred in the fs module", [error]));
                    }
                }));
            });
        },

        /**
         * @private
         * @return {Array.<Path>}
         */
        _readDirectorySync: function() {
            var _this = this;
            var files = fs.readdirSync(this.getAbsolutePath());
            var pathArray = [];
            files.forEach(function(name) {
                var childPathString = _this.getAbsolutePath() + path.sep + name;
                pathArray.push(new Path(childPathString));
            });
            return pathArray;
        },

        /**
         * @private
         * @param {string} encoding
         * @param {function(Throwable, string=)=} callback
         */
        _readFile: function(encoding, callback) {
            var _this = this;
            Path.fileHandleSemaphore.acquire(function() {
                fs.readFile(_this.getAbsolutePath(), encoding, $traceWithError(function(error, data) {
                    Path.fileHandleSemaphore.release();
                    if (!error) {
                        callback(null, data);
                    } else {
                        callback(new Exception("FsError", {}, "An error occurred in the fs module", [error]));
                    }
                }));
            });
        },

        /**
         * @private
         * @param {?string} encoding
         */
        _readFileSync: function(encoding) {
            return fs.readFileSync(this.getAbsolutePath(), encoding);
        },

        /**
         * @private
         * @param {function(Throwable, Path=)} callback
         */
        _readSymlink: function(callback) {
            var _this = this;
            Path.fileHandleSemaphore.acquire(function() {
                fs.readlink(_this.getAbsolutePath(), $traceWithError(function(error, symlinkedPathString) {
                    Path.fileHandleSemaphore.release();
                    if (!error) {
                        callback(null, new Path(symlinkedPathString));
                    } else {
                        callback(new Exception("FsError", {}, "An error occurred in the fs module.", [error]));
                    }
                }));
            });
        },

        /**
         * @private
         * @return {Path}
         */
        _readSymlinkSync: function() {
            return new Path(fs.readlinkSync(this.getAbsolutePath()));
        },

        /**
         * @private
         * @param {function(Throwable=)} callback
         */
        _removeDirectoryOrRemoveSymlinkedDirectory: function(callback) {
            var _this = this;
            $if (function(flow) {
                    _this._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        _this._readSymlink(function(error, symlinkedPath) {
                            if (!error) {
                                symlinkedPath._removeDirectoryOrRemoveSymlinkedDirectory(function(error) {
                                    flow.complete(error);
                                });
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._deleteSymlink(function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$else(
                $task(function(flow) {
                    Path.fileHandleSemaphore.acquire(function() {
                        fs.rmdir(_this.getAbsolutePath(), $traceWithError(function(error) {
                            Path.fileHandleSemaphore.release();
                            if (!error) {
                                flow.complete();
                            } else {
                                flow.error(new Exception("FsError", {}, "An error occurred in the fs module", [error]));
                            }
                        }));
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         */
        _removeDirectoryOrRemoveSymlinkedDirectorySync: function() {
            if (this._isSymlinkSync()) {
                var symlinkedPath = this._readSymlinkSync();
                symlinkedPath._removeDirectoryOrRemoveSymlinkedDirectorySync();
                this._deleteSymlinkSync();
            } else {
                fs.rmdirSync(this.getAbsolutePath());
            }
        },

        /**
         * @private
         * @param {Path} namePath
         * @param {function(Throwable=)} callback
         */
        _rename: function(namePath, callback) {
            var _this = this;
            Path.fileHandleSemaphore.acquire(function() {
                fs.rename(_this.getAbsolutePath(), namePath.getAbsolutePath(), $traceWithError(function(error) {
                    Path.fileHandleSemaphore.release();
                    if (!error) {
                        callback();
                    } else {
                        callback(new Exception("FsError", {}, "An error occurred in the fs module.", [error]));
                    }
                }));
            });
        },

        /**
         * @private
         * @param {Path} namePath
         */
        _renameSync: function(namePath) {
            fs.renameSync(this.getAbsolutePath(), namePath.getAbsolutePath());
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {function(Throwable=)} callback
         */
        _renameDirectoryOrRenameSymlinkedDirectory: function(movePath, callback) {
            var _this = this;
            $if (function(flow) {
                    _this._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._readSymlink(function(error, symlinkedPath) {
                        if (!error) {
                            //TODO BRN: After the directory is moved, should we also update the symlink?
                            symlinkedPath._renameDirectoryOrRenameSymlinkedDirectory(movePath, function(error) {
                                flow.complete(error);
                            });
                        } else {
                            flow.error(error);
                        }
                    })
                })
            ).$else(
                $task(function(flow) {
                    _this._rename(movePath, function(error) {
                        flow.complete(error);
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         */
        _renameDirectoryOrRenameSymlinkedDirectorySync: function(movePath) {
            if (this._isSymlinkSync()) {
                var symlinkedPath = this._readSymlinkSync();
                symlinkedPath._renameDirectoryOrRenameSymlinkedDirectorySync(movePath);

                //TODO BRN: After moving a file that a symlink points to, should we update the symlink as well?
            } else {
                this._renameSync(movePath);
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {function(Throwable=)} callback
         */
        _renameFileOrRenameSymlinkedFile: function(movePath, callback) {
            var _this = this;
            $if (function(flow) {
                    _this._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._readSymlink(function(error, symlinkedPath) {
                        if (!error) {
                            //TODO BRN: After the file is moved, should we also update the symlink?
                            symlinkedPath._renameFileOrRenameSymlinkedFile(movePath, function(error) {
                                flow.complete(error);
                            });
                        } else {
                            flow.error(error);
                        }
                    })
                })
            ).$else(
                $task(function(flow) {
                    _this._rename(movePath, function(error) {
                        flow.complete(error);
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} movePath
         */
        _renameFileOrRenameSymlinkedFileSync: function(movePath) {
            if (this._isSymlinkSync()) {
                var symlinkedPath = this._readSymlinkSync();
                symlinkedPath._renameFileOrRenameSymlinkedFileSync(movePath);

                //TODO BRN: After moving a file that a symlink points to, should we update the symlink as well?
            } else {
                this._renameSync(movePath);
            }
        },

        /**
         * @private
         * @param {Path} movePath
         * @param {function(Throwable=)} callback
         */
        _renameSymlink: function(movePath, callback) {
            this._rename(movePath, callback);
        },

        /**
         * @private
         * @param {Path} movePath
         */
        _renameSymlinkSync: function(movePath) {
            this._renameSync(movePath);
        },

        /**
         * @private
         * @param {function(Throwable, Path=)} callback
         */
        _resolveSymlinks: function(callback) {
            var _this = this;
            this._isSymlink(function(error, isSymlink) {
                if (!error) {
                    if (isSymlink) {
                        _this._readSymlink(function(error, symlinkedPath) {
                            if (!error) {
                                symlinkedPath._resolveSymlinks(callback);
                            } else {
                                callback(error);
                            }
                        });
                    } else {
                        callback(null, _this);
                    }
                } else {
                    callback(error);
                }
            });
        },

        /**
         * @private
         * @return {Path}
         */
        _resolveSymlinksSync: function() {
            if (this.isSymlinkSync()) {
                var symlinkedPath = this._readSymlinkSync();
                return symlinkedPath._resolveSymlinksSync();
            } else {
                return this;
            }
        },

        /**
         * @private
         * @param {Path} symlinkPath
         * @param {function(Throwable=)} callback
         */
        _symlink: function(symlinkPath, callback) {
            var _this = this;
            Path.fileHandleSemaphore.acquire(function() {
                fs.symlink(_this.getAbsolutePath(), symlinkPath.getAbsolutePath(), 'junction', $traceWithError(function(error) {
                    Path.fileHandleSemaphore.release();
                    if (!error) {
                        callback();
                    } else {
                        callback(new Exception("FsError", {}, "An error occurred in the fs module.", [error]));
                    }
                }));
            });
        },

        /**
         * @private
         * @param {Path} symlinkPath
         */
        _symlinkSync: function(symlinkPath) {
            fs.symlinkSync(this.getAbsolutePath(), symlinkPath.getAbsolutePath(), 'junction');
        },

        /**
         * @private
         * @param {Path} symlinkPath
         * @param {Path.SyncMode} syncMode (defaults to Path.SyncMode.STOP)
         * @param {function(Throwable=)} callback
         */
        _symlinkTo: function(symlinkPath, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    _this._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._symlinkDirectoryTo(symlinkPath, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$elseIf (function(flow) {
                    _this._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $task(function(flow) {
                    _this._symlinkFileTo(symlinkPath, syncMode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$else (
                $task(function(flow) {
                    flow.error(new Exception("PathIsUnknownType", {}, "Cannot symlink path '" + _this.getAbsolutePath() + "' because it is an " +
                        "unknown type."));
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} symlinkPath
         * @param {Path.SyncMode} syncMode
         */
        _symlinkToSync: function(symlinkPath, syncMode) {
            if (this._isDirectorySync(false)) {
                this._symlinkDirectoryToSync(symlinkPath, syncMode);
            } else if (this._isFileSync(false)) {
                this._symlinkFileToSync(symlinkPath, syncMode);
            } else {
                throw new Exception("PathIsUnknownType", {}, "Cannot symlink path '" + this.getAbsolutePath() + "' because it is an unknown type.");
            }
        },


        /**
         * @private
         * @param {Path} symlinkPath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _symlinkDirectoryTo: function(symlinkPath, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    symlinkPath._exists(false, function(throwable, exists) {
                        if (!throwable) {
                            flow.assert(exists);
                        } else {
                            flow.error(throwable);
                        }
                    });
                },
                $task(function(flow) {
                    switch (syncMode) {
                        case Path.SyncMode.MERGE_REPLACE:
                        case Path.SyncMode.REPLACE:
                            _this._symlinkDirectoryReplace(symlinkPath, function(error) {
                                flow.complete(error);
                            });
                            break;
                        default:
                            flow.complete();
                    }
                })
            ).$else(
                $task(function(flow) {
                    _this._symlink(symlinkPath, function(error) {
                        flow.complete(error);
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} symlinkPath
         * @param {Path.SyncMode} syncMode
         */
        _symlinkDirectoryToSync: function(symlinkPath, recursive, syncMode) {
            if (symlinkPath._existsSync(false)) {

                //NOTE BRN: Do nothing in the STOP case

                switch (syncMode) {
                    case Path.SyncMode.MERGE_REPLACE:
                    case Path.SyncMode.REPLACE:
                        this._symlinkDirectoryReplaceSync(symlinkPath);
                        break;
                }
            } else {
                this._symlinkSync(symlinkPath);
            }
        },

        /**
         * @private
         * @param {Path} symlinkPath
         * @param {function(Throwable=)} callback
         */
        _symlinkDirectoryReplace: function(symlinkPath, callback) {
            var _this = this;
            $if (function(flow) {
                    symlinkPath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        symlinkPath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._symlink(symlinkPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    symlinkPath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        symlinkPath._deleteFile(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        _this._symlink(symlinkPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    symlinkPath._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        symlinkPath._deleteSymlink(function(error) {
                            flow.complete(error);
                        })
                    }),
                    $task(function(flow) {
                        _this._symlink(symlinkPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} symlinkPath
         */
        _symlinkDirectoryReplaceSync: function(symlinkPath) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (symlinkPath._isDirectorySync(false)) {
                symlinkPath._deleteDirectorySync(true);
                this._symlinkSync(symlinkPath);
            } else if (symlinkPath._isFileSync(false)) {
                symlinkPath._deleteFileSync();
                this._symlinkSync(symlinkPath);
            } else if (symlinkPath._isSymlinkSync()) {
                symlinkPath._deleteSymlinkSync();
                this._symlinkSync(symlinkPath);
            }
        },

        /**
         * @private
         * @param {Path} intoPath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _symlinkDirectoryContentsInto: function(intoPath, syncMode, callback) {
            var _this = this;
            var childPathArray = [];
            $series([
                $task(function(flow) {
                    _this._readDirectory(function(error, pathArray) {
                        if (!error) {
                            childPathArray = pathArray;
                            flow.complete();
                        } else {
                            flow.error(error);
                        }
                    });
                }),
                $task(function(flow) {
                    $forEachParallel(childPathArray, function(flow, childPath) {
                        var symlinkPath = new Path(intoPath.getAbsolutePath() + path.sep + childPath.getName());
                        childPath._symlinkTo(symlinkPath, syncMode, function(error) {
                            flow.complete(error);
                        });
                    }).execute(function(error) {
                        flow.complete(error);
                    });
                })
            ]).execute(callback);
        },

        /**
         * @private
         * @param {Path} intoPath
         * @param {Path.SyncMode} syncMode
         */
        _symlinkDirectoryContentsIntoSync: function(intoPath, syncMode) {
            var childPathArray = intoPath._readDirectorySync();
            childPathArray.forEach(function(childPath) {
                var symlinkPath = new Path(intoPath.getAbsolutePath() + path.sep + childPath.getName());
                childPath._symlinkToSync(symlinkPath, syncMode);
            });
        },

        /**
         * @private
         * @param {Path} symlinkPath
         * @param {Path.SyncMode} syncMode
         * @param {function(Throwable=)} callback
         */
        _symlinkFileTo: function(symlinkPath, syncMode, callback) {
            var _this = this;
            $if (function(flow) {
                    symlinkPath._exists(false, function(throwable, exists) {
                        if (!throwable) {
                            flow.assert(exists);
                        } else {
                            flow.error(throwable);
                        }
                    });
                },
                $task(function(flow) {
                    switch (syncMode) {
                        case Path.SyncMode.MERGE_REPLACE:
                        case Path.SyncMode.REPLACE:
                            _this._symlinkFileReplace(symlinkPath, function(error) {
                                flow.complete(error);
                            });
                            break;
                        default:
                            flow.complete();
                    }
                })
            ).$else(
                $series([
                    $task(function(flow) {
                        _this._symlink(symlinkPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} symlinkPath
         * @param {Path.SyncMode} syncMode
         */
        _symlinkFileToSync: function(symlinkPath, syncMode) {
            if (symlinkPath._existsSync(false)) {

                //NOTE BRN: Do nothing in the STOP case AND the MERGE_STOP

                switch (syncMode) {
                    case Path.SyncMode.MERGE_REPLACE:
                    case Path.SyncMode.REPLACE:
                        this._symlinkFileReplaceSync(symlinkPath);
                        break;
                }
            } else {
                this._symlinkSync(symlinkPath);
            }
        },

        /**
         * @private
         * @param {Path} symlinkPath
         * @param {function(Throwable=)} callback
         */
        _symlinkFileReplace: function(symlinkPath, callback) {
            var _this = this;
            $if (function(flow) {
                    symlinkPath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            flow.assert(isDirectory);
                        } else {
                            flow.error(error);
                        }
                    });
                },
                $series([
                    $task(function(flow) {
                        symlinkPath._deleteDirectory(true, function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._symlink(symlinkPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    symlinkPath._isFile(false, function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        symlinkPath._deleteFile(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._symlink(symlinkPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$elseIf(function(flow) {
                    symlinkPath._isSymlink(function(error, isFile) {
                        if (!error) {
                            flow.assert(isFile);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        symlinkPath._deleteSymlink(function(error) {
                            flow.complete(error);
                        });
                    }),
                    $task(function(flow) {
                        _this._symlink(symlinkPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).execute(callback);
        },

        /**
         * @private
         * @param {Path} symlinkPath
         */
        _symlinkFileReplaceSync: function(symlinkPath) {

            //NOTE BRN: Do nothing if we don't recognize the type (symlink)

            if (symlinkPath._isDirectorySync(false)) {
                symlinkPath._deleteDirectorySync(true);
                this._symlinkSync(symlinkPath);
            } else if (symlinkPath._isFileSync(false)) {
                symlinkPath._deleteFileSync();
                this._symlinkSync(symlinkPath);
            } else if (symlinkPath._isSymlinkSync()) {
                symlinkPath._deleteSymlinkSync();
                this._symlinkSync(symlinkPath);
            }
        },

        /**
         * @private
         * @param {function(Throwable=)} callback
         */
        _unlinkFileOrUnlinkSymlinkedFile: function(callback) {
            var _this = this;
            $if (function(flow) {
                    _this._isSymlink(function(error, isSymlink) {
                        if (!error) {
                            flow.assert(isSymlink);
                        } else {
                            flow.error(error);
                        }
                    })
                },
                $series([
                    $task(function(flow) {
                        _this._readSymlink(function(error, symlinkedPath) {
                            if (!error) {
                                symlinkedPath._unlinkFileOrUnlinkSymlinkedFile(function(error) {
                                    flow.complete(error);
                                });
                            } else {
                                flow.error(error);
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._deleteSymlink(function(error) {
                            flow.complete(error);
                        });
                    })
                ])
            ).$else(
                $task(function(flow) {
                    Path.fileHandleSemaphore.acquire(function() {
                        fs.unlink(_this.getAbsolutePath(), $traceWithError(function(error) {
                            Path.fileHandleSemaphore.release();
                            if (!error) {
                                flow.complete();
                            } else {
                                flow.error(new Exception("FsError", {}, "An error occurred in the fs module." [error]));
                            }
                        }));
                    });
                })
            ).execute(callback);
        },

        /**
         * @private
         */
        _unlinkFileOrUnlinkSymlinkedFileSync: function() {
            if (this._isSymlinkSync()) {
                var symlinkedPath = this._readSymlinkSync();
                symlinkedPath._unlinkFileOrUnlinkSymlinkedFileSync();
                this._deleteSymlinkSync();
            } else {
                fs.unlinkSync(this.getAbsolutePath());
            }
        },

        /**
         * @private
         * @param {string} data
         * @param {string} encoding
         * @param {function(Throwable=)} callback
         */
        _writeFile: function(data, encoding, callback) {
            var _this = this;
            Path.fileHandleSemaphore.acquire(function() {
                fs.writeFile(_this.getAbsolutePath(), data, encoding, $traceWithError(function(error) {
                    Path.fileHandleSemaphore.release();
                    if (error) {
                        error = new Exception("FsError", {}, "An error occurred in the fs module", [error]);
                    }
                    if (callback) {
                        callback(error);
                    } else {
                        throw error;
                    }
                }));
            });
        },

        /**
         * @private
         * @param {string} data
         * @param {string} encoding
         */
        _writeFileSync: function(data, encoding) {
            fs.writeFileSync(this.getAbsolutePath(), data, encoding);
        },


        //---------------------------

        /**
         * @private
         * @param {Path} intoPath
         * @param {function(Throwable=)} callback
         */
        ensurePath: function(intoPath, callback) {
            $series([
                $task(function(flow) {
                    intoPath._exists(true, function(throwable, exists) {
                        if (!throwable) {
                            if (!exists) {
                                intoPath._createDirectory(true, "0777", function(error) {
                                    flow.complete(error);
                                });
                            } else {
                                flow.complete();
                            }
                        } else {
                            flow.error(throwable);
                        }
                    })
                }),
                $task(function(flow) {
                    intoPath._isDirectory(true, function(error, isDirectory) {
                        if (!error) {
                            if (!isDirectory) {
                                flow.error(new Exception("PathIsNotADirectory", {}, "Path '" + intoPath.getAbsolutePath() + "' is not a directory."));
                            } else {
                                flow.complete();
                            }
                        } else {
                            flow.error(error);
                        }
                    });
                })
            ]).execute(callback);
        },

        /**
         * @private
         * @param {Path} intoPath
         */
        ensurePathSync: function(intoPath) {
            if (!intoPath._existsSync(true)) {
                intoPath._createDirectorySync(true, "0777");
            } else if (!intoPath._isDirectorySync(true)) {
                throw new Exception("PathIsNotADirectory", {}, "Path '" + intoPath.getAbsolutePath() + "' is not a directory.");
            }
        },

        /**
         * @private
         * @param {string} mode
         * @param {function(Throwable=)} callback
         */
        ensureParentDirectories: function(mode, callback) {
            var parentPath = this.getParentPath();
            $if (function(flow) {
                    parentPath._exists(false, function(throwable, exists) {
                        if (!throwable) {
                            flow.assert(!exists);
                        } else {
                            flow.error(throwable);
                        }
                    });
                },
                $task(function(flow) {
                    parentPath._createDirectory(true, mode, function(error) {
                        flow.complete(error);
                    });
                })
            ).$else(
                $task(function(flow) {

                    // NOTE BRN: We check this to make sure that the given path did not exist already as a file.

                    parentPath._isDirectory(false, function(error, isDirectory) {
                        if (!error) {
                            if (!isDirectory) {
                                flow.error(new Exception("PathAlreadyExists", {}, "Could not create parent directory '" + parentPath.getAbsolutePath() +
                                    "' because it already exists and is not a directory."));
                            } else {
                                flow.complete();
                            }
                        } else {
                            flow.error(error);
                        }
                    });
                })
            ).execute(function(error) {
                if (callback) {
                    if (!error) {
                        callback(null, this);
                    } else {
                        callback(error);
                    }
                }
            });
        },

        /**
         * @private
         * @param {string} mode
         */
        ensureParentDirectoriesSync: function(mode) {
            var parentPath = this.getParentPath();
            if (!parentPath._existsSync(false)) {
                parentPath.createDirectorySync(true, mode);
            } else {
                if (!parentPath._isDirectorySync(false)) {
                    throw new Exception("PathAlreadyExists", {}, "Could not create parent directory '" + parentPath.getAbsolutePath() +
                        "' because it already exists and is not a directory.");
                }
            }
        }
    });


    //-------------------------------------------------------------------------------
    // Static Properties
    //-------------------------------------------------------------------------------

    /**
     * @enum {string}
     */
    Path.SyncMode = {
        MERGE_REPLACE: "SyncMode:MergeReplace",
        MERGE_STOP: "SyncMode:MergeStop",
        REPLACE: "SyncMode:Replace",
        STOP: "SyncMode:Stop"
    };

    // TODO BRN: This semaphore was a rather cheap way of achieving isolation within file system transactions. Would be more
    // performant if each transaction was isolated based upon the parts of the file system that it touches. This way
    // we could still have parallel operations that affect different parts of the file system.

    //TODO BRN: Replace this with a WriteReadLock that blocks the system when a write operation is taking place and only
    // allows one write operation to take place at a time. Read operations should be free to execute in parallel as long
    // as a write lock is not in place. A write lock should halt all further reads and wait until the current reads are
    // complete until it performs it's write

    /**
     * @private
     * @type {Semaphore}
     */
    Path.transactionSemaphore = new Semaphore(1);

    //TODO BRN: See if there's a way we can retrieve the file handle limit from the OS. This is well below the Mac OS X default of 256

    /**
     * @const {number}
     */
    Path.FILE_HANDLE_LIMIT = 128;

    /**
     * @private
     * @type {Semaphore}
     */
    Path.fileHandleSemaphore = new Semaphore(Path.FILE_HANDLE_LIMIT);


    //-------------------------------------------------------------------------------
    // Export
    //-------------------------------------------------------------------------------

    bugpack.export('bugfs.Path', Path);
});

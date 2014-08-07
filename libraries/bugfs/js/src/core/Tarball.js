/*
 * Copyright (c) 2014 airbug inc. http://airbug.com
 *
 * bugfs may be freely distributed under the MIT license.
 */


//-------------------------------------------------------------------------------
// Annotations
//-------------------------------------------------------------------------------

//@Export('bugfs.Tarball')

//@Require('Class')
//@Require('Flows')
//@Require('TypeUtil')
//@Require('bugfs.Path')


//-------------------------------------------------------------------------------
// Context
//-------------------------------------------------------------------------------

require('bugpack').context("*", function(bugpack) {

    //-------------------------------------------------------------------------------
    // Common Modules
    //-------------------------------------------------------------------------------

    var fs          = require('fs');
    var path        = require('path');
    var tar         = require('tar');
    var zlib        = require('zlib');


    //-------------------------------------------------------------------------------
    // BugPack
    //-------------------------------------------------------------------------------

    var Class       = bugpack.require('Class');
    var Flows       = bugpack.require('Flows');
    var TypeUtil    = bugpack.require('TypeUtil');
    var Path        = bugpack.require('bugfs.Path');


    //-------------------------------------------------------------------------------
    // Simplify References
    //-------------------------------------------------------------------------------

    var $series     = Flows.$series;
    var $task       = Flows.$task;


    //-------------------------------------------------------------------------------
    // Declare Class
    //-------------------------------------------------------------------------------

    /**
     * @class
     * @extends {Path}
     */
    var Tarball = Class.extend(Path, {

        _name: "bugfs.Tarball",


        //-------------------------------------------------------------------------------
        // Public Methods
        //-------------------------------------------------------------------------------

        /**
         * @param {(string|Path)} intoPath
         * @param {?(boolean|function(Error, Path))=} resolveSymlink (defaults to false)
         * @param {?function(Error)} callback
         */
        extractInto: function(intoPath, resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            intoPath = TypeUtil.isString(intoPath) ? new Path(intoPath) : intoPath;
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;

            var _this = this;
            Path.transactionSemaphore.acquire(function() {
                $series([
                    $task(function(flow) {
                        _this._exists(resolveSymlink, function(exists) {
                            if (!exists) {
                                flow.error(new Error("Cannot extract tarball '" + _this.getAbsolutePath() + "' because it " +
                                    "does not exist."));
                            } else {
                                flow.complete();
                            }
                        });
                    }),
                    $task(function(flow) {
                        _this._isTarball(resolveSymlink, function(error, isTarball) {
                            if (!error) {
                                if (isTarball) {
                                    flow.complete();
                                } else {
                                    flow.error(new Error("Cannot extract tarball '" + _this.getAbsolutePath() +
                                        "' because it is not a tarball."));
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
                        _this._extractInto(intoPath, function(error) {
                            flow.complete(error);
                        });
                    })
                ]).execute(function(error) {
                    Path.transactionSemaphore.release();
                    if (callback) {
                        if (!error) {
                            callback(null);
                        } else {
                            callback(error);
                        }
                    }
                });
            });
        },

        /**
         * @param {(boolean|function(Error, boolean))} resolveSymlink (defaults to false)
         * @param {?function(Error, boolean)=} callback
         */
        isTarball: function(resolveSymlink, callback) {
            if (TypeUtil.isFunction(resolveSymlink)) {
                callback = resolveSymlink;
            }
            resolveSymlink = TypeUtil.isBoolean(resolveSymlink) ? resolveSymlink : false;
            var _this = this;
            Path.transactionSemaphore.acquire(function() {
                _this._isTarball(resolveSymlink, function(error, result) {
                    Path.transactionSemaphore.release();
                    callback(error, result);
                })
            });
        },


        //-------------------------------------------------------------------------------
        // Private Methods
        //-------------------------------------------------------------------------------

        /**
         * @private
         * @param {Path} intoPath
         * @param {function(Error)} callback
         */
        _extractInto: function(intoPath, callback) {
            fs.createReadStream(this.getAbsolutePath())
                .pipe(tar.Extract({ path: intoPath.getAbsolutePath() }))
                .on("error", function (error) {
                    callback(error);
                })
                .on("end", function () {
                    callback(null);
                });
        },

        /**
         * @param {boolean} resolveSymlink
         * @param {function(Error, boolean)} callback
         */
        _isTarball: function(resolveSymlink, callback) {
            var _this = this;
            this._isFile(resolveSymlink, function(error, result) {
                if (!error) {
                    if (result) {

                        //TODO BRN: This is not a very solid check. Should do a better job of validating a tarball.

                        if (_this.getExtName() === "tgz") {
                            callback(null, true);
                        } else {
                            callback(null, false);
                        }
                    }
                } else {
                    callback(error);
                }
            });
        }
    });


    //-------------------------------------------------------------------------------
    // Export
    //-------------------------------------------------------------------------------

    bugpack.export('bugfs.Tarball', Tarball);
});

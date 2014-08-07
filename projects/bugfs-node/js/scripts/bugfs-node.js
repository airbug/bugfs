/*
 * Copyright (c) 2014 airbug inc. http://airbug.com
 *
 * bugfs may be freely distributed under the MIT license.
 */


//-------------------------------------------------------------------------------
// Script
//-------------------------------------------------------------------------------

var bugpackApi  = require("bugpack");
var bugpack     = bugpackApi.loadContextSync(module);
bugpack.loadExportSync("bugfs.BugFs");
var BugFs       = bugpack.require("bugfs.BugFs");


//-------------------------------------------------------------------------------
// Exports
//-------------------------------------------------------------------------------

module.exports = BugFs;

//-------------------------------------------------------------------------------
// Annotations
//-------------------------------------------------------------------------------

//@Export('bugfs.BugFs')

//@Require('Class')
//@Require('TypeUtil')
//@Require('bugfs.Path')


//-------------------------------------------------------------------------------
// Common Modules
//-------------------------------------------------------------------------------

var bugpack         = require('bugpack').context();


//-------------------------------------------------------------------------------
// BugPack
//-------------------------------------------------------------------------------

var Class           = bugpack.require('Class');
var TypeUtil        = bugpack.require('TypeUtil');
var Path            = bugpack.require('bugfs.Path');


//-------------------------------------------------------------------------------
// Declare Class
//-------------------------------------------------------------------------------

var BugFs  = {};


//-------------------------------------------------------------------------------
// Static Methods
//-------------------------------------------------------------------------------

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {(boolean|function(Throwable, Path=))} recursive (defaults to true)
 * @param {(Path.SyncMode|function(Throwable, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {(boolean|function(Throwable, Path=))=} resolveSymlink (defaults to false)
 * @param {function(Throwable, Path=)=} callback
 */
BugFs.copy = function(fromPath, intoPath, recursive, syncMode, resolveSymlink, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.copy(intoPath, recursive, syncMode, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {boolean=} recursive
 * @param {Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {boolean=} resolveSymlink (defaults to false)
 * @return {Path}
 */
BugFs.copySync = function(fromPath, intoPath, recursive, syncMode, resolveSymlink) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    return fromPath.copySync(intoPath, recursive, syncMode, resolveSymlink);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {(boolean|function(Throwable=))} recursive (defaults to true)
 * @param {(Path.SyncMode|function(Throwable=))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {(boolean|function(Throwable, Path=))=} resolveSymlink (defaults to false)
 * @param {function(Throwable, Path=)=} callback
 */
BugFs.copyContents = function(fromPath, intoPath, recursive, syncMode, resolveSymlink, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.copyContents(intoPath, recursive, syncMode, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?(boolean|function(Error))=} recursive (defaults to true)
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?(boolean|function(Error, Path))=} resolveSymlink (defaults to false)
 * @param {?function(Error, Path)} callback
 */
BugFs.copyDirectory = function(fromPath, intoPath, recursive, syncMode, resolveSymlink, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.copyDirectory(intoPath, recursive, syncMode, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?boolean=} recursive (defaults to true)
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?boolean=} resolveSymlink (defaults to false)
 * @return {Path}
 */
BugFs.copyDirectorySync = function(fromPath, intoPath, recursive, syncMode, resolveSymlink) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    return fromPath.copyDirectorySync(intoPath, recursive, syncMode, resolveSymlink);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {(boolean|function(Throwable=))} recursive (defaults to true)
 * @param {(Path.SyncMode|function(Throwable=))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {(boolean|function(Throwable=))=} resolveSymlink (defaults to false)
 * @param {function(Throwable=)=} callback
 */
BugFs.copyDirectoryContents = function(fromPath, intoPath, recursive, syncMode, resolveSymlink, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.copyDirectoryContents(intoPath, recursive, syncMode, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?boolean=} recursive (defaults to true)
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?boolean=} resolveSymlink (defaults to false)
 */
BugFs.copyDirectoryContentsSync = function(fromPath, intoPath, recursive, syncMode, resolveSymlink) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    return fromPath.copyDirectoryContentsSync(intoPath, recursive, syncMode, resolveSymlink);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {(Path.SyncMode|function(Error, Path=))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {(boolean|function(Error, Path=))=} resolveSymlink (defaults to false)
 * @param {function(Error, Path=)=} callback
 */
BugFs.copyFile = function(fromPath, intoPath, syncMode, resolveSymlink, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.copyFile(intoPath, syncMode, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?boolean=} resolveSymlink (defaults to false)
 * @return {Path}
 */
BugFs.copyFileSync = function(fromPath, intoPath, syncMode, resolveSymlink) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    return fromPath.copyFileSync(intoPath, syncMode, resolveSymlink);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?function(Error, Path)} callback
 */
BugFs.copySymlink = function(fromPath, intoPath, syncMode, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.copySymlink(intoPath, syncMode, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @return {Path}
 */
BugFs.copySymlinkSync = function(fromPath, intoPath, syncMode) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    return fromPath.copySymlinkSync(intoPath, syncMode);
};

/**
 * @param {(string|Path)} dirPath
 * @param {?(boolean|function(Error))=} createParentDirectories (defaults to true)
 * @param {?(string|function(Error))=} mode (defaults to '0777')
 * @param {?function(Error, Path)} callback
 */
BugFs.createDirectory = function(dirPath, createParentDirectories, mode, callback) {
    dirPath = TypeUtil.isString(dirPath) ? new Path(dirPath) : dirPath;
    dirPath.createDirectory(createParentDirectories, mode, callback);
};

/**
 * @param {(string|Path)} dirPath
 * @param {?boolean=} createParentDirectories
 * @param {?string=} mode
 * @return {Path}
 */
BugFs.createDirectorySync = function(dirPath, createParentDirectories, mode) {
    dirPath = TypeUtil.isString(dirPath) ? new Path(dirPath) : dirPath;
    return dirPath.createDirectorySync(createParentDirectories, mode);
};

/**
 * @param {(string|Path)} filePath
 * @param {?(boolean|function(Error))=} createParentDirectories (defaults to true)
 * @param {?function(Error, Path)} callback
 */
BugFs.createFile = function(filePath, createParentDirectories, callback) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    filePath.createFile(createParentDirectories, callback);
};

/**
 * @param {(string|Path)} filePath
 * @param {?boolean=} createParentDirectories (defaults to true)
 * @return {Path}
 */
BugFs.createFileSync = function(filePath, createParentDirectories) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    return filePath.createFileSync(createParentDirectories);
};

/**
 * @param {(string|Path)} filePath
 * @param {Object} options
 * @return {ReadStream}
 */
BugFs.createReadStream = function(filePath, options) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    return filePath.createReadStream(options);
};

/**
 * @param {(string|Path)} filePath
 * @param {Object} options
 * @return {WriteStream}
 */
BugFs.createWriteStream = function(filePath, options) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    return filePath.createWriteStream(options);
};

/**
 * @param {(string|Path)} aPath
 * @param {?(boolean|function(Error))=} recursive
 * @param {?(boolean|function(Error))=} resolveSymlink (defaults to false)
 * @param {?function(Error)} callback
 */
BugFs.delete = function(aPath, recursive, resolveSymlink, callback) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    aPath.delete(recursive, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} aPath
 * @param {?boolean=} recursive
 * @param {?boolean=} resolveSymlink (defaults to false)
 */
BugFs.deleteSync = function(aPath, recursive, resolveSymlink) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    aPath.deleteSync(recursive, resolveSymlink);
};

/**
 * @param {(string|Path)} dirPath
 * @param {?(boolean|function(Error))=} recursive (defaults to true)
 * @param {?(boolean|function(Error))=} resolveSymlink (defaults to false)
 * @param {?function(Error)} callback
 */
BugFs.deleteDirectory = function(dirPath, recursive, resolveSymlink, callback) {
    dirPath = TypeUtil.isString(dirPath) ? new Path(dirPath) : dirPath;
    dirPath.deleteDirectory(recursive, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} dirPath
 * @param {?boolean=} recursive
 * @param {?boolean=} resolveSymlink (defaults to false)
 */
BugFs.deleteDirectorySync = function(dirPath, recursive, resolveSymlink) {
    dirPath = TypeUtil.isString(dirPath) ? new Path(dirPath) : dirPath;
    dirPath.deleteDirectorySync(recursive, resolveSymlink);
};

/**
 * @param {(string|Path)} filePath
 * @param {?(boolean|function(Error))=} resolveSymlink (defaults to false)
 * @param {?function(Error)} callback
 */
BugFs.deleteFile = function(filePath, resolveSymlink, callback) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    filePath.deleteFile(resolveSymlink, callback);
};

/**
 * @param {(string|Path)} filePath
 * @param {?boolean=} resolveSymlink (defaults to false)
 */
BugFs.deleteFileSync = function(filePath, resolveSymlink) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    filePath.deleteFileSync(resolveSymlink);
};

/**
 * @static
 * @param {(string | Path)} aPath
 * @param {?(boolean|function(boolean))=} resolveSymlink (defaults to false)
 * @param {function(Throwable, boolean=)=} callback
 */
BugFs.exists = function(aPath, resolveSymlink, callback) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    aPath.exists(resolveSymlink, callback);
};

/**
 * @param {string} aPath
 * @param {?boolean=} resolveSymlink (defaults to false)
 * @return {boolean}
 */
BugFs.existsSync = function(aPath, resolveSymlink) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    return aPath.existsSync(resolveSymlink);
};

/**
 * @param {(string|Path)} aPath
 * @param {?(boolean|function(Error, boolean))=} resolveSymlink (defaults to false)
 * @param {function(Error, boolean)} callback
 */
BugFs.isDirectory = function(aPath, resolveSymlink, callback) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    aPath.isDirectory(resolveSymlink, callback);
};

//TODO BRN: Should this return false if the path does not exist, or should it throw an error like it does now?
/**
 * @param {(string|Path)} aPath
 * @param {?boolean=} resolveSymlink
 * @return {boolean}
 */
BugFs.isDirectorySync = function(aPath, resolveSymlink) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    return aPath.isDirectorySync(resolveSymlink);
};

/**
 * @param {(string|Path)} directoryPath
 * @param {?(boolean|function(Error, boolean))=} resolveSymlink (defaults to false)
 * @param {?function(Error, boolean)=} callback
 */
BugFs.isDirectoryEmpty = function(directoryPath, resolveSymlink, callback) {
    directoryPath = TypeUtil.isString(directoryPath) ? new Path(directoryPath) : directoryPath;
    directoryPath.isDirectory(resolveSymlink, callback);
};

/**
 * @param {(string|Path)} directoryPath
 * @param {?boolean=} resolveSymlink
 * @return {boolean}
 */
BugFs.isDirectoryEmptySync = function(directoryPath, resolveSymlink) {
    directoryPath = TypeUtil.isString(directoryPath) ? new Path(directoryPath) : directoryPath;
    return directoryPath.isDirectoryEmptySync(resolveSymlink);
};

/**
 * @param {(string|Path)} aPath
 * @param {?(boolean|function(Error, boolean))=} resolveSymlink (defaults to false)
 * @param {?function(Error, boolean)=} callback
 */
BugFs.isFile = function(aPath, resolveSymlink, callback) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    aPath.isFile(resolveSymlink, callback);
};

/**
 * @param {(string|Path)} aPath
 * @param {?boolean=} resolveSymlink
 * @return {boolean}
 */
BugFs.isFileSync = function(aPath, resolveSymlink) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    return aPath.isFileSync(resolveSymlink);
};

/**
 * @param {(string|Path)} aPath
 * @param {function(Error, boolean)} callback
 */
BugFs.isSymbolicLink = function(aPath, callback) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    aPath.isSymbolicLink(callback);
};

/**
 * @param {(string|Path)} aPath
 * @return {boolean}
 */
BugFs.isSymbolicLinkSync = function(aPath) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    return aPath.isSymbolicLinkSync();
};

/**
 * @param {Array.<(string|Path)>} pathArray
 * @return {Path}
 */
BugFs.joinPaths = function(pathArray) {
    var paths = [];
    for (var i = 0, size = pathArray.length; i < size; i++) {
        var path = BugFs.path(pathArray[i]);
        if (path) {
            paths.push(path);
        }
    }

    if (paths.length > 1) {
        var firstPath = paths.shift();
        return firstPath.joinPaths(paths);
    } else if (paths.length === 1) {
        return paths[0];
    } else {
        throw new Error("joinPaths requires at least one path argument");
    }
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?(boolean|function(Error))=} resolveSymlink (defaults to false)
 * @param {?function(Error)} callback
 */
BugFs.move = function(fromPath, intoPath, syncMode, resolveSymlink, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.move(intoPath, syncMode, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?boolean=} resolveSymlink (defaults to false)
 */
BugFs.moveSync = function(fromPath, intoPath, syncMode, resolveSymlink) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.moveSync(intoPath, syncMode, resolveSymlink);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?(boolean|function(Error))=} recursive (defaults to true)
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?(boolean|function(Error, Path))=} resolveSymlink (defaults to false)
 * @param {?function(Error, Path)} callback
 */
BugFs.moveDirectory = function(fromPath, intoPath, recursive, syncMode, resolveSymlink, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.moveDirectory(intoPath, recursive, syncMode, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?boolean=} recursive (defaults to true)
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?boolean=} resolveSymlink (defaults to false)
 * @return {Path}
 */
BugFs.moveDirectorySync = function(fromPath, intoPath, recursive, syncMode, resolveSymlink) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    return fromPath.moveDirectorySync(intoPath, recursive, syncMode, resolveSymlink);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?(boolean|function(Error))=} recursive (defaults to true)
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?(boolean|function(Error))=} resolveSymlink (defaults to false)
 * @param {?function(Error)} callback
 */
BugFs.moveDirectoryContents = function(fromPath, intoPath, recursive, syncMode, resolveSymlink, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.moveDirectoryContents(intoPath, recursive, syncMode, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?boolean=} recursive (defaults to true)
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?boolean=} resolveSymlink (defaults to false)
 */
BugFs.moveDirectoryContentsSync = function(fromPath, intoPath, recursive, syncMode, resolveSymlink) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.moveDirectoryContentsSync(intoPath, recursive, syncMode, resolveSymlink);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?(boolean|function(Error, Path))=} resolveSymlink (defaults to false)
 * @param {?function(Error, Path)} callback
 */
BugFs.moveFile = function(fromPath, intoPath, syncMode, resolveSymlink, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.moveFile(intoPath, syncMode, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?boolean=} resolveSymlink (defaults to false)
 * @return {Path}
 */
BugFs.moveFileSync = function(fromPath, intoPath, syncMode, resolveSymlink) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    return fromPath.moveFileSync(intoPath, syncMode, resolveSymlink);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?function(Error, Path)} callback
 */
BugFs.moveSymlink = function(fromPath, intoPath, syncMode, callback) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    fromPath.moveSymlink(intoPath, syncMode, callback);
};

/**
 * @param {(string|Path)} fromPath
 * @param {(string|Path)} intoPath
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @return {Path}
 */
BugFs.moveSymlinkSync = function(fromPath, intoPath, syncMode) {
    fromPath = TypeUtil.isString(fromPath) ? new Path(fromPath) : fromPath;
    return fromPath.moveSymlinkSync(intoPath, syncMode);
};

/**
 * @param {(string|Path)} aPath
 * @return {Path}
 */
BugFs.parentPath = function(aPath) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    return aPath.getParentPath();
};

/**
 * @param {(string|Path)} pathString
 * @return {Path}
 */
BugFs.path = function(pathString) {
    if (Class.doesExtend(pathString, Path)) {
        return pathString;
    } else if (TypeUtil.isString(pathString)) {
        return new Path(pathString);
    }
    //Ignore if not a string or path
};

/**
 * @param {(string|Path)} directoryPath
 * @param {?(boolean|function(Error, Array.<Path>))=} resolveSymlink (defaults to true)
 * @param {?function(Error, Array.<Path>)} callback
 */
BugFs.readDirectory = function(directoryPath, resolveSymlink, callback) {
    directoryPath = TypeUtil.isString(directoryPath) ? new Path(directoryPath) : directoryPath;
    directoryPath.readDirectory(resolveSymlink, callback);
};

/**
 * @param {(string|Path)} directoryPath
 * @param {?boolean=} resolveSymlink (defaults to true)
 * @return {Array.<Path>}
 */
BugFs.readDirectorySync = function(directoryPath, resolveSymlink) {
    directoryPath = TypeUtil.isString(directoryPath) ? new Path(directoryPath) : directoryPath;
    return directoryPath.readDirectorySync(resolveSymlink);
};

/**
 * @param {(string|Path)} filePath
 * @param {(string|function(Throwable, *))} encoding
 * @param {(boolean|function(Throwable, *))=} resolveSymlink (defaults to true)
 * @param {function(Throwable, *)=} callback
 */
BugFs.readFile = function(filePath, encoding, resolveSymlink, callback) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    filePath.readFile(encoding, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} filePath
 * @param {?string=} encoding
 * @param {?boolean=} resolveSymlink (defaults to true)
 * @return {*}
 */
BugFs.readFileSync = function(filePath, encoding, resolveSymlink) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    return filePath.readFileSync(encoding, resolveSymlink);
};

/**
 * @param {(Path | string)} fromPath
 * @param {(Path | string)} intoPath
 * @return {string}
 */
BugFs.relativePath = function(fromPath, intoPath) {
    fromPath = BugFs.path(fromPath);
    intoPath = BugFs.path(intoPath);
    return fromPath.getRelativePath(intoPath);
};

/**
 * @param {Array.<(string|Path)>} pathArray
 * @return {Path}
 */
BugFs.resolvePaths = function(pathArray) {
    var paths = [];
    for (var i = 0, size = pathArray.length; i < size; i++) {
        var path = BugFs.path(pathArray[i]);
        if (path) {
            paths.push(path);
        }
    }

    if (paths.length > 1) {
        var firstPath = paths.shift();
        return firstPath.resolvePaths(paths);
    } else if (paths.length === 1) {
        return paths[0];
    } else {
        throw new Error("resolvePaths requires at least one path argument");
    }
};

/**
 * @param {(string|Path)} aPath
 * @param {(string|Path)} intoPath
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?function(Error, Path)} callback
 */
BugFs.symlinkInto = function(aPath, intoPath, syncMode, callback) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    aPath.symlinkInto(intoPath, callback);
};

/**
 * @param {(string|Path)} aPath
 * @param {(string|Path)} linkPath
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @return {Path}
 */
BugFs.symlinkIntoSync = function(aPath, linkPath, syncMode) {
    aPath = TypeUtil.isString(aPath) ? new Path(aPath) : aPath;
    return aPath.symlinkIntoSync(linkPath, syncMode);
};

/**
 * @param {(string|Path)} directoryPath
 * @param {(string|Path)} intoPath
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?function(Error, Path)} callback
 */
BugFs.symlinkDirectoryInto = function(directoryPath, intoPath, syncMode, callback) {
    directoryPath = TypeUtil.isString(directoryPath) ? new Path(directoryPath) : directoryPath;
    directoryPath.symlinkDirectoryInto(intoPath, syncMode, callback);
};

/**
 * @param {(string|Path)} directoryPath
 * @param {(string|Path)} intoPath
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @return {Path}
 */
BugFs.symlinkDirectoryIntoSync = function(directoryPath, intoPath, syncMode) {
    directoryPath = TypeUtil.isString(directoryPath) ? new Path(directoryPath) : directoryPath;
    return directoryPath.symlinkDirectoryIntoSync(intoPath, syncMode);
};

/**
 * @param {(string|Path)} directoryPath
 * @param {(string|Path)} intoPath
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?function(Error, Path)} callback
 */
BugFs.symlinkDirectoryContentsInto = function(directoryPath, intoPath, syncMode, callback) {
    directoryPath = TypeUtil.isString(directoryPath) ? new Path(directoryPath) : directoryPath;
    directoryPath.symlinkDirectoryContentsInto(intoPath, syncMode, callback);
};

/**
 * @param {(string|Path)} directoryPath
 * @param {(string|Path)} intoPath
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @return {Path}
 */
BugFs.symlinkDirectoryContentsIntoSync = function(directoryPath, intoPath, syncMode) {
    directoryPath = TypeUtil.isString(directoryPath) ? new Path(directoryPath) : directoryPath;
    return directoryPath.symlinkDirectoryContentsIntoSync(intoPath, syncMode);
};

/**
 * @param {(string|Path)} filePath
 * @param {(string|Path)} intoPath
 * @param {?(Path.SyncMode|function(Error))=} syncMode (defaults to Path.SyncMode.STOP)
 * @param {?function(Error, Path)} callback
 */
BugFs.symlinkFileInto = function(filePath, intoPath, syncMode, callback) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    filePath.symlinkFileInto(intoPath, syncMode, callback);
};

/**
 * @param {(string|Path)} filePath
 * @param {(string|Path)} intoPath
 * @param {?Path.SyncMode=} syncMode (defaults to Path.SyncMode.STOP)
 * @return {Path}
 */
BugFs.symlinkFileIntoSync = function(filePath, intoPath, syncMode) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    return filePath.symlinkFileIntoSync(intoPath, syncMode);
};

/**
 * @param {(string|Path)} filePath
 * @param {string} data
 * @param {(string|function(Throwable=))=} encoding
 * @param {(boolean|function(Throwable=))=} resolveSymlink (defaults to true)
 * @param {function(Throwable=)=} callback
 */
BugFs.writeFile = function(filePath, data, encoding, resolveSymlink, callback) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    filePath.writeFile(data, encoding, resolveSymlink, callback);
};

/**
 * @param {(string|Path)} filePath
 * @param {string} data
 * @param {string=} encoding
 * @param {boolean=} resolveSymlink (defaults to true)
 */
BugFs.writeFileSync = function(filePath, data, encoding, resolveSymlink) {
    filePath = TypeUtil.isString(filePath) ? new Path(filePath) : filePath;
    filePath.writeFileSync(data, encoding, resolveSymlink);
};


//-------------------------------------------------------------------------------
// Export
//-------------------------------------------------------------------------------

bugpack.export('bugfs.BugFs', BugFs);

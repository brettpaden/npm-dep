// Some good comments should go here

var program = require('commander');
var npm = require('npm');              // we will load npm's configuration so that this script
                                       // does the "right thing" by default.
var readInstalled = require("npm/node_modules/read-installed");
var util = require('util');
var async = require('async');
var path = require('path');

var npmdep = exports;

npmdep.deps_map = new Object;

npmdep.start = function(){
	npm.load(npmdep.process)
}

npmdep.process = function() {
	program
		.version('0.0.1')
		.parse(process.argv);
	var paths_to_scan = [];

	// got command line instructions on which paths to scan
	if ( program.args.length > 0) {
		paths_to_scan = program.args;
	}
	// otherwise, let npm's configuration tell us what to do
	else {
		paths_to_scan.push('./node_modules');
		var npm_prefix = npm.config.get('prefix');
		if (npm_prefix != null) {
			if (process.platform == 'windows') {
				paths_to_scan.push(npm_prefix + '/node_modules');
			}
			else {
				paths_to_scan.push(npm_prefix + '/lib/node_modules');
			}
		}
	}
 
    npm.config.set('global', true);
    readInstalled(
	    path.resolve(npm.dir,".."),
		npm.config.get('depth'),
	    function(er, data) { 
			npmdep.scan_dep_tree(data.dependencies, npmdep.dump_deps);
		}
	);
}

var function_call_count = 0;

npmdep.dump_deps = function() {
	for (var i in npmdep.deps_map) {
		var dep_tree = npmdep.deps_map[i];
		if (dep_tree.versions().length >1) {
			console.log(dep_tree.name);
			var versions_length = dep_tree.versions().length;
			for (var i in dep_tree.versions()) {
				var tree_string = (versions_length-1) == i ? "└──" : "├──";
				var version = dep_tree.versions()[i];
				var parent_nice = dep_tree.parents[version].reverse().join(' -> ');
			    console.log(tree_string + version + "\t" + parent_nice);
			}
			console.log();
		}
	}
}

npmdep.scan_dep_tree = function(deps, callback) {
	function_call_count++;
    async.map(Object.keys(deps), function(name_id, callback) {
		var dep = deps[name_id];
		if (!npmdep.deps_map[name_id]) {
			npmdep.deps_map[name_id] = new npmdep.dep_tree(name_id);
		}
		npmdep.deps_map[name_id].set_version_parents(dep);
		if (dep.dependencies) {
			npmdep.scan_dep_tree(dep.dependencies)
		}
		callback(undefined, name_id);
	}, function(error, results) {
		if (error) {
			console.error("Unable to iterate over dependency array: " + error);
		}
	});
	function_call_count--;
	if (function_call_count == 0 && callback) {
		callback();
	}
}

npmdep.dep_tree = function(name_id) {
	this.name = name_id;
	this._versions = new Object;
	this.parents  = new Object;
    this.set_version_parents = function(dep) {
	    this._versions[dep.version] = true;
	    this.parents[dep.version] = this.recurse_parents(dep, []);
	}
	this.recurse_parents = function(dep, parents) {
		if (dep.parent != undefined) { 
			if (dep.parent._id) {
				parents.push(dep.parent._id);
				return this.recurse_parents(dep.parent, parents);
			}
		}
		return parents;
	}
	this.versions = function() {
		return Object.keys(this._versions);
	}
	return this;
}

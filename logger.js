'use strict';

var
	log    = require('x-log'),
	merge  = require('x-common').merge,
	x      = require('x-common').extend;

/*!
 * Extends the standard logger with the additional data to log.
 */
var Logger = {
	
	extend:function (msg) {
		var extenders = this.extenders;
		if (extenders)for (var i = 0, l = extenders.length; i < l; i++) msg = merge(msg, extenders[i].call(this[this.property]));
		return msg;
	},
	
	add:function (f/*!function to extend log message*/) {
		if (typeof(f) == 'string')f = function (property) {
			return function () {
				var r = {};
				if (this) {
					r[property] = this[property];
				}
				return r;
			};
		}(f);
		this.extenders = this.extenders || [];
		this.extenders.push(f);
		return this;
	}
};

/*!
 * Adds the standard log levels defined in 'util/log.js' to the request logger object.
 */
function setLevels() { // request logger must have same methods as log
	for (var level in log.levels) { // define functions if available in log
		if (log[level]){
			Logger[level] = (function (level) {
				return function (msg, meta) {
					var meta = meta || msg || {};
					if ('string' === typeof meta) meta = {};
					if ('string' !== typeof msg) msg = '' + msg;
					log[level](msg, x(this.extend(meta),{name:this.name}));
				};
			})(level);
		}
		else {
			if (Logger[level]) {
				delete Logger[level];
			}
		}
	}
}

setLevels(); // set them now and later on each change
log.level_listeners.push(setLevels);

module.exports = function(name,application,property/*!optional*/) {
	var l = Object.create(Logger);
	l.name = name;
	if(application){
		l.add(function(){return {application:application}; });
	}
	if (property){
		l.property = property;
	}
	return l;
};

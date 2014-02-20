'use strict';
/*! Rotating Log File Transport for winston
 * like winston file transport, but not rotating on size but based on time periods
 */
var
	winston        = require('./node_modules/winston/lib/winston'),
	util           = require('util'),
	path           = require('path'),
	winston_common = require('./node_modules/winston/lib/winston/common');

//
// options, like for file transport but also notices the stringify option
//
var RotatingLogFile = module.exports = function (options) {
	winston.transports.File.call(this, options);
	
	this.stringify        = options.stringify;
	this.timeSpan         = options.timeSpan; // in milliseconds
	this.current_suffix   = options.suffix || '';
	this.prev_suffix      = this.current_suffix;
};

//
// Inherit from winston File Logger`.
//
util.inherits(RotatingLogFile,winston.transports.File);



RotatingLogFile.prototype.__defineGetter__('suffix',function (){
	return this.current_suffix ;
});


RotatingLogFile.prototype.__defineSetter__('suffix',function (v){ // set a new log file file suffix
	this.current_suffix = v;
});

RotatingLogFile.prototype.__defineGetter__('fullname',function (){
	return path.join(this.dirname,this._basename);
});


//
// Expose the name of this Transport on the prototype
//
RotatingLogFile.prototype.name = 'rotatingLogFile';

//
// ### function log (level, msg, [meta], callback)
// #### @level {string} Level at which to log the message.
// #### @msg {string} Message to log
// #### @meta {Object} **Optional** Additional metadata to attach
// #### @callback {function} Continuation to respond to when complete.
// Core logging method exposed to Winston. Metadata is optional.
//
RotatingLogFile.prototype.log = function (level, msg, meta, callback) {
	if (this.silent) {
		return callback(null, true);
	}
	
	var self = this,output = winston_common.log({
		json:      this.json,
		level:     level,
		message:   msg,
		meta:      meta,
		stringify: this.stringify,
		timestamp: this.timestamp
	});
	
	output = output + '\n';
	
	this._size += output.length;
	if (!this.filename) {
		//
		// If there is no `filename` on this instance then it was configured
		// with a raw `WriteableStream` instance and we should not perform any
		// size restrictions.
		//
		this.stream.write(output);
		self._lazyDrain();
	} else {
		this.open(function (err) {
			if (err) {
				//
				// If there was an error enqueue the message
				//
				return self._buffer.push(output);
			}
			self.stream.write(output);
			self._lazyDrain();
		});
	}
	
	callback(null, true);
};

//
// ### function open (callback)
// #### @callback {function} Continuation to respond to when complete
// Checks to see if a new file needs to be created based on the `maxsize`
// (if any) and the current size of the file used.
//
RotatingLogFile.prototype.open = function (callback) {
	if (this.opening) {
		//
		// If we are already attempting to open the next
		// available file then respond with a value indicating
		// that the message should be buffered.
		//
		
		return callback(true);
	} else {
		if (!this.stream
		  || (this.maxsize && this._size >= this.maxsize)
		  || (this.timeSpan && (!this.period /*!first time*/|| Date.now() >= this.period + this.timeSpan ))
		  || this.current_suffix !== this.prev_suffix
		   ) {
			//
			// If we dont have a stream or have exceeded our size, then create
			// the next stream and respond with a value indicating that
			// the message should be buffered.
			//
			callback(true);
			return this._createStream();
		} else {
			//
			// Otherwise we have a valid (and ready) stream.
			//
			callback();
		}
	}
};

//
// ### @private function _getFile ()
// Gets the next filename to use for this instance
// in the case that log filesizes are being capped.
//
RotatingLogFile.prototype._getFile = function (inc) {
	
	if(this.timeSpan){
		
		if(!this.period/*!first time*/|| Date.now() >= this.period + this.timeSpan || this.current_suffix !== this.prev_suffix ){
			
			// note: for periods without log data no empty log file will be generated, thus those periods have no log file
			
			this.period      = Math.floor(Date.now()/this.timeSpan)*this.timeSpan;
			this.prev_suffix = this.current_suffix;
			
			// generate new basename based on current basename (==file base name), we need to remove date and suffix first
			var
				SEPARATOR       = '.',
				ext             = path.extname(this._basename),
				basename        = path.basename(this._basename, ext),
				last_sep        = basename.lastIndexOf(SEPARATOR),
				second_last_sep = last_sep > 0 ? basename.lastIndexOf(SEPARATOR, last_sep-1) : -1,
				date_begin      = second_last_sep > -1 ? second_last_sep : last_sep, // second last or last depends on having suffix or not
				suffix          = this.current_suffix ? SEPARATOR + this.current_suffix : '';
			
			if(date_begin > -1) basename=basename.substring( 0, date_begin ); // remove any existing date extension and suffix if it exists
			
			// create file name component date
			var date=(new Date(this.period)).toISOString(); // date is something like 2012-03-13T17:35:24.696Z
			date=date.replace(/Z$/,'');    // remove last Z
			//note in general period is rounded via fix time span, so we have non significant 0 min, 0 sec. wich we are removed:
			date=date.replace(/.000$/,''); // remove 0 milliseconds
			date=date.replace(/:00$/,'');  // remove 0 seconds
			date=date.replace(/:00$/,'');  // remove 0 minutes
			date=date.replace(/T00$/,'');  // remove 0 hours
			date=date.replace(/T$/,'');    // remove last T in case time was not there at all
			date=date.replace(/[^\d]+/g,'_');  // replace all non digits (- : , T Z what ever) in an iso date by _    p.e. result is 2012_03_13
			
			this._basename = basename + SEPARATOR + date + suffix + ext; // note date, suffix are prefixed with SEPERATOR iff not empty
		}
	}
	// handle other file size based extensions as before...
	return winston.transports.File.prototype._getFile.call(this,inc);
};

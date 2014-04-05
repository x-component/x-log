'use strict';

/*
 * x-log
 * =====
 *
 * a simple log mobule which produces a daily file log,
 * and in development mode an additional console log
 *
 * each log call produces normally a single line of json formated info:
 *
 * example:
 *
 *      {"timestamp":"2013-06-16T20:18:31.225Z","level":"info","message":"the message string passed", ...some other meta info... }
 *
 *
 * The keys `timestamp` , `level` and `message` are predefined and added automatically, the rest is the passed meta info.
 *
 * **usage**
 *
 *     var log = require('x-log');
 *
 *     log.debug && log.debug('message',{info:'optional and extra meta info',more:'info'});
 *
 *     log.debug && log.debug('another message');
 *
 *     log.error && log.error('message', e ); // e can be of type Error, p.e. a catched exception
 *
 *
 * The levels provided are:
 *
 *  - debug
 *  - info
 *  - warn
 *  - error
 *
 * If the log level is set to warn, log.debug and log.info do not exist!
 * Therefore ALWAYS check if the function exist. Even for the error
 * level:
 *
 *     log.error && log.error('message', e );
 * 
 * **stacktrace**
 *
 * if an Error object is passed as meta info, the stacktrace is added to the log meta data.
 *
 * **guidelines**
 *
 * If you want to log dynamic information please provide it within the meta object as
 * the last parameter, *not* in the message text. Example:
 *
 * do *NOT* use this:
 *
 *     log.info('login for user with firstname:' + user.firstname ); // DON'T DO THIS!
 *     log.info('login for user with lastnam:' + user.lastname ); // DON'T DO THIS!
 *
 * instead log always in a single log statement and pass meta info as an
 * object like this:
 *
 *     log.info && log.info('user logged in', {user:user} );
 *
 * Note: It is expected you just pass *small* *non cyclic* objects as meta info. Although there is a
 * protection against cyclic objects, its better to **not pass big objects**, like p.e. the node
 * request object.
 *
 * Note: Do not pass `Buffer` Objects as meta data, as it produces a
 * very very very very long byte array log line.
 *
 *
 * **output**
 *
 * The json output can be formatted, and the file location can be
 * configured. (see the config file)
 *
 * Note: To prevent in cluster mode that all workers are writing constantly in the same
 * file one can define a file suffix per worker
 *
 *     log.file.suffix = worker.id;
 *
 * The suffix is simply appended to the created log file, thus this will
 * create a distinct daily logfile for each worker.
 */

//use x-env
//
var
	process         = require('x-process'),
	noop            = function(){},
	browser         = process.browser,
	winston         = !browser?  require('winston') : {
		setLevels        : noop, // obj name->#
		add              : noop, // transport
		remove           : noop, // transport
		handleExceptions : noop, // our generic handler
		debug : noop,           //
		info  : noop,            //
		warn  : noop,            //
		error : noop,            //
		transports : { Console:noop }
	},
	
	cycle           = !browser ? require('cycle') : { decycle:function(o){return o;} },
	flatten         = require('x-common').flatten,
	merge           = require('x-common').merge,
	pluck           = require('x-common').pluck,
	RotatingLogFile = !browser ? require('./rotating') : noop ,
	config          = require('x-configs')(__dirname+'/config'),
	env             = process.env.NODE_ENV||'development',
	development     = ~env.indexOf('development');


var sort = function(o){
	
	// timestamp, level, message should always come first, so we extract them first
	var
		r=pluck(o,['timestamp','level','message'],true),
		keys=Object.keys(o).sort();
	
	for(var i=0,l=keys.length,k,v;i<l;i++){k=keys[i];v=o[k];r[k]=v;} // add key values now in sorted order to new object
	
	return r; // JSON normally respects the order how keys where added
};

// merge some default behavior with the config
config=merge({
	global:{
		timestamp:function(){return (new Date()).toISOString();}, // this must be fast!
		
		
		handleExceptions:true,
		exitOnError:false,
		
		//----------LEVELS------------------------------------------
		levels:{
			debug: 0,
			info : 1,
			warn : 2,
			error: 3
		},
		level:'info',
		
		//----------FORMATS------------------------------------------
		formats:{
			pretty        : function(o){ return JSON.stringify(o,null,'\t'); },
			normal        : function(o){ return JSON.stringify(o);},
			sorted        : function(o){ return JSON.stringify(sort(o));},
			flat          : function(o){ return JSON.stringify(flatten(o));},
			sorted_flat   : function(o){ return JSON.stringify(sort(flatten(o))); }
		},
		format:'sorted_flat',
		json:true
	},
	//----------FILE------------------------------------------
	file:{
		filename: 'node.log',
		timeSpan: 24*60*60*1000  // 24 hours UTC log rotation
	},
	//----------CONSOLE------------------------------------------
	console:{
		on:true,
		format:'pretty'
	}
},config);


//----------LEVELS------------------------------------------
winston.setLevels(config.global.levels);
winston.level=config.global.level;

// ---------FORMAT------------------------------------------
// create a config specfic stringify (for file, console, etc...)
function stringify(config){
	return function(o){
		try{
			return config.formats[config.format](o);
		}catch(e){
			return '{ msg:"exception in log handling", exception: "'+e+'"}'; // explicit to prevent uncaught exceptions in log handling which would cause endless loops
		}
	};
}
//----------FILE-LOGGER------------------------------------------
config.file=merge({},config.global,config.file); // merge global in file config
config.file.stringify=config.file.stringify||stringify(config.file);

var file_logger = new RotatingLogFile(config.file);
winston.add(file_logger, null, true);

//----------CONSOLE------------------------------------------
config.console=merge({},config.global,config.console); // merge global in console config
config.console.stringify=config.console.stringify||stringify(config.console);

var _console_on=true;

//----------CONSOLE-BROWSER------------------------------------------
if(browser){
	(function(config){
		var str=stringify(config);
		for(var l in config.levels ){
			winston[l]=(function(level){ return function ( msg, meta ){
				if(!_console_on) return;
				if(typeof(msg)==='object'){ meta=msg; msg=void 0; }
				console[level](str(merge({},meta,{timestamp:config.timestamp(),level:level},msg?{message:msg}:{})));
			};})(l);
		}
	})(config.console);
}

function use_console(on){
	if(_console_on!=on){
		if (on) {
			winston.add(winston.transports.Console,config.console);
		} else {
			// remove console logger
			try{winston.remove(winston.transports.Console);}catch(e){}
		}
		_console_on=on;
	}
	return _console_on;
}
use_console(false);
use_console(config.console.on);

//----------FUNCTIONS-------------------------------------------
// we nee to wrap the winston function because thy use a wrong cloning
// which can not handle cycles. Sending a cyclic object makes the
// logging go throught the stack limit.:-(
//
// decycling works, but is to slow and doesnt respect toJSON,
// so we try using JSON first and then use decyle
// here we decycle the arguments before senidng through to winston
//
function decycle(f){
	return function(){
		var args=Array.prototype.slice.call(arguments);
		var new_args;
		// handle Errors special:
		try {
			// first we hope somebody added toJSON to prevent any long
			// messages, and cycles
			new_args=JSON.parse(JSON.stringify(args));
		}catch(e){
			//debugger;
			// normally an exception occurs because of cycles , so we decyle here, slow but it works
			// not this removes the toJSON...
			new_args=cycle.decycle(args);
		}
		
		// handle errors
		for(var i=0,l=args.length;i<l;i++){
			if( args[i] && new_args[i] && typeof(args[i])==='object' && (args[i] instanceof Error) ){
				if( typeof(new_args[i]) !== 'object' ){
					new_args[i]={error:new_args[i]};
				}
				// generate and add stack as array
				var stack = args[i].stack;
				if( stack && typeof(stack)==='string') stack = stack.split('\n');
				new_args[i].stack = stack;
			}
		}
		
		f.apply(this,new_args);
	};
}

winston.handleExceptions();

//----------EXPORTS------------------------------------------

var M=module.exports={
	debug : decycle(winston.debug),
	info  : decycle(winston.info ),
	warn  : decycle(winston.warn ),
	error : decycle(winston.error),
	
	level_listeners:[],
	
	levels:config.global.levels,
	
	get level() { return winston.level; },
	
	set level(l){ // remove and add log functions depending on level
		var levels=config.global.levels;
		
		for(var level in levels){
			if(levels[level]<levels[l]){
				if(M[level]) delete M[level];
			} else {
				M[level]=decycle(winston[level]);
			}
		}
		winston.level=l;
		
		// simplistic notify
		var i=M.level_listeners.length;while(i--){
			try{
				M.level_listeners[i].call(M);
			}catch(e){ winston.error('error during set error level notification',e); }
		}
	},
	
	console:function(on){
		config.console.on=use_console(on);
	},
	
	file:{
		get suffix()  { return file_logger.suffix; },
		set suffix(v) { file_logger.suffix = v; },
		
		get name()    { return file_logger.fullname; },
		
		get _logger()  { return file_logger; } // for testing purposes
	},
	
	/*!
	 * Creates a logger with an application name added to each log statement.
	 */
	logger: function() {
		return require('./logger').apply(this, arguments);
	},
	
	setup:function(server){
		var f;
		
		server.get('/log',function(req,res){res.json({log:config});});
		
		//--LEVEL
		server.get('/log/level',function(req,res){res.json({log:{level:M.level}});});
		for(var level in config.global.levels){
			server.get('/log/level/'+level,function(l){return function(req,res){M.level=l;res.redirect('/log/level');};}(level));
		}
		
		//--FILE
		server.get('/log/file',function(req,res){res.json({log:{file:config.file}});});
		for(f in config.file.formats){
			server.get('/log/file/format/'+f,function(ff){return function(req,res){config.file.format=ff;res.redirect('/log/file');};}(f));
		}
		
		//--CONSOLE
		server.get('/log/console',function(req,res){res.json({log:{console:config.console}});});
		for(f in config.console.formats){
			server.get('/log/console/format/'+f,function(ff){return function(req,res){config.console.format=ff;res.redirect('/log/console');};}(f));
		}
		server.get('/log/console/on',function(req,res){config.console.on=use_console(true);res.redirect('/log/console');});
		server.get('/log/console/off',function(req,res){config.console.on=use_console(false);res.redirect('/log/console');});
	}
};

// set configured level
M.level=config.global.level;

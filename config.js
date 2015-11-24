'use strict';

var
	merge=require('x-common').merge;

var generic = {
	global : {
		level : 'info' // one of debug,info,warn,error
	},
	file : {
		filename   : __dirname + '/logs/node.log',
		pattern    : '.yyyy-MM-dd.%s.log',
		format     : 'sorted'
	},
	console : {
		on : false,
		format : 'pretty' // one of pretty, normal, flat , sorted_flat  JSON
	}
};

module.exports={
	development:merge({},generic,{
		global : {
			level : 'debug' // one of debug,info,warn,error
		},
		console : {
			on : true
		}
	}),
	
	test : merge({},generic,{
		file:{
			//filename : '/logs/nodejs/node.log'
		}
	}),
	
	production : merge({},generic,{
		global : {
			level : 'info'
		},
		console : {
			on : false
		},
		file:{
			//filename : '/logs/nodejs/node.log'
		}
	})
};

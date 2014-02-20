'use strict';

var verbose = false ; // true;

var
	vows   = require('vows'),
	assert = require('assert'),
	log    = require('../index'),
	fs     = require('fs'),
	path   = require('path'),
	suite  = vows.describe('log');

log.console(verbose);

suite.addBatch({
	'file suffix': {
		topic : log,
		'suffix log-test':{
			topic: function( log_topic ){
				var self = this;
				log_topic.file.suffix = 'log-test';
				var flushed = false;
				log_topic.file._logger.once('flush',function(){
					self.callback(log_topic);
				});
				log_topic.file._logger.options.highWaterMark=100; // just 100 bytes before drain
				log_topic.info('trigger file creation by using logger');
				log_topic.info('stream should trigger drain also on 0.10.25');
			},
			'check for filename with log-test':function(log_topic){
				assert( log_topic.file.name && ~log_topic.file.name.indexOf('log-test'));
			}
		}
	}
});

suite.addBatch({
	'rotation': {
		topic : function(){
			var
				self           =this,
				RotatingLogFile=require('../rotating');
			
			var
				filename = path.join(__dirname,'log-test-rotating.log'),
				ext      = path.extname(filename),
				basename = path.basename(filename,ext),
				dirname  = path.dirname(filename),
				timeSpan = 10;
			
			var result = {
				timeSpan  : timeSpan,
				logger    : new RotatingLogFile({filename : filename, timeSpan:timeSpan }),
				basename  : basename,
				dirname   : dirname,
				files     : function(cb){ // read current used file names and content
					var topic = this;
					fs.mkdir(topic.dirname,function(){
						fs.readdir(topic.dirname,function(err,names){
							var files={},count=0;
							for( var i = 0,l=names.length, name; i<l; i++ ){
								name = names[i];
								if(name && name.substring( 0, topic.basename.length ) === topic.basename){
									files[name]=true;
									count++;
								}
							}
							// read content
							if(0===count){
								cb(files);
								return;
							}
							for( var f in files ){
								fs.readFile(path.join(topic.dirname,f), (function(f){ return function (err, data) {
									files[f]=''+data;
									count--;
									if( 0===count ){
										//debugger;
										verbose && log.info && log.info('files',{files:files});
										cb(files);
									}
								}; })(f));
							}
						});
					});
				}
			};
			result.files(function(files){
				for( var f in files) fs.unlinkSync(path.join(dirname,f));
				self.callback(result);
			});
		},
		'log':{
			topic: function(topic){
				var self=this;
				// after the next flush TEST-2 is written to file and we can check where it landed
				topic.logger.once('flush',function(){
					self.callback(topic);
				});
				topic.logger.options.highWaterMark=10; // just 100 bytes before drain
				topic.logger.log('info', 'TEST', {}, function(){});
			},
			'new file':{ topic: function(topic){ topic.files(this.callback); },
				'exists':function(files){
					assert(Object.keys(files).length===1);
				},
				'contains test':function(files){
					var f=Object.keys(files)[0];
					assert( f &&-1 < files[f].indexOf('TEST'));
				}
			},
			'await new period':{
				topic:function(topic){
					var self = this;
					setTimeout( function(){
						// after the next flush TEST-2 is written to file and we can check where it landed
						topic.logger.once('flush',function(){
							self.callback(topic);
						});
						topic.logger.options.highWaterMark=10;
						topic.logger.log('info', 'TEST-2',{},function(){});
					},topic.timeSpan+1);
				},
				'check second new file':{ topic: function(topic){ topic.files(this.callback); },
					'second exists':function(files){
						assert(Object.keys(files).length===2);
					},
					'second contains test 2':function(files){
						var f=Object.keys(files)[1];
						assert( f &&-1 < files[f].indexOf('TEST-2'));
					}
				}
			}
		},
		teardown: function(topic){ // remove all log-test-rotating* files
			topic.files(function(files){
				for( var f in files) fs.unlinkSync(path.join(topic.dirname,f));
			});
		}
	}
});

suite.exportTo(module,{error:false});

[![Build Status](https://travis-ci.org/x-component/x-log.png?v0.0.6)](https://travis-ci.org/x-component/x-log)
=======================================================================================================



x-log
=====

a simple log mobule which produces a daily file log,
and in development mode an additional console log

each log call produces normally a single line of json formated info:

example:

     {"timestamp":"2013-06-16T20:18:31.225Z","level":"info","message":"the message string passed", ...some other meta info... }


The keys `timestamp` , `level` and `message` are predefined and added automatically, the rest is the passed meta info.

**usage**

    var log = require('x-log');

    log.debug && log.debug('message',{info:'optional and extra meta info',more:'info'});

    log.debug && log.debug('another message');

    log.error && log.error('message', e ); // e can be of type Error, p.e. a catched exception


The levels provided are:

 - debug
 - info
 - warn
 - error

If the log level is set to warn, log.debug and log.info do not exist!
Therefore ALWAYS check if the function exist. Even for the error
level:

    log.error && log.error('message', e );

**stacktrace**

if an Error object is passed as meta info, the stacktrace is added to the log meta data.

**guidelines**

If you want to log dynamic information please provide it within the meta object as
the last parameter, *not* in the message text. Example:

do *NOT* use this:

    log.info('login for user with firstname:' + user.firstname ); // DON'T DO THIS!
    log.info('login for user with lastnam:' + user.lastname ); // DON'T DO THIS!

instead log always in a single log statement and pass meta info as an
object like this:

    log.info && log.info('user logged in', {user:user} );

Note: It is expected you just pass *small* *non cyclic* objects as meta info. Although there is a
protection against cyclic objects, its better to **not pass big objects**, like p.e. the node
request object.

Note: Do not pass `Buffer` Objects as meta data, as it produces a
very very very very long byte array log line.


**output**

The json output can be formatted, and the file location can be
configured. (see the config file)

Note: To prevent in cluster mode that all workers are writing constantly in the same
file one can define a file suffix per worker

    log.file.suffix = worker.id;

The suffix is simply appended to the created log file, thus this will
create a distinct daily logfile for each worker.

'use strict';

var suExec = require('./index.js');

suExec.init();

process.setgid('nogroup');
process.setuid('nobody');

suExec.execFile('/sbin/ifconfig', ['/sbin/ifconfig'], {
	stdin: '/dev/null',
	stdout: '/tmp/test.out',
	stderr: '/dev/null'
}, function(err, status, signal){
	console.log(arguments);
});

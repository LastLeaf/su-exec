'use strict';

var suExec = require('./index.js');

suExec.init();

process.setgid('nogroup');
process.setuid('nobody');

suExec.execFile('/sbin/ifconfig', ['/sbin/ifconfig'], {
	stdout: '/tmp/test.out'
}, function(err, status, signal){
	console.log(arguments);
	suExec.execPath('cat', ['cat', '-'], {
		stdin: '/tmp/test.out',
		stdout: '/tmp/test.out.2'
	}, function(){
		console.log(arguments);
	});
});

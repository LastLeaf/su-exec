'use strict';

var childProcess = require('child_process');

var rootProc = null;
var reqQueue = [];
var cbMap = {};

exports.init = function(){
	if(rootProc) return;

	// start root daemon
	if(process.getuid() !== 0) {
		throw('Su-exec module should be initialized with root privilege.');
		return -1;
	}
	rootProc = childProcess.execFile(__dirname + '/build/Release/su-exec');

	// error handling
	rootProc.on('error', function(){
		rootProc = null;
	});
	rootProc.on('exit', function(){
		// quit current process if root process is killed
		process.exit();
	});

	rootProc.stdout.on('data', function(buf){
		var prev = 0;
		for(var i=0; i<buf.length; i++) {
			if(buf[i] != '|') continue;
			var str = buf.slice(prev, i).toString('utf8');
			prev = i+1;
			if(str.charAt(0) === '+') {
				// new process
				var pid = str.slice(1);
				if(cbMap[pid]) {
					cb.call(global, cbMap[pid]);
					delete cbMap[info[1]];
				} else {
					cbMap[pid] = reqQueue.shift();
				}
			} else if(str.charAt(0) === '-') {
				// end process
				var info = str.split('-');
				if(Number(info[2])) var err = new Error('Su-exec failed to execute.');
				else var err = null;
				if(info[1]) {
					cbMap[info[1]](err, Number(info[3]), Number(info[4]));
					delete cbMap[info[1]];
				} else {
					cbMap[info[1]] = [err, Number(info[3]), Number(info[4])];
				}
			}
		}
	});
};

exports.execFile = function(file, argv, options, cb){
	if(!rootProc) {
		setTimeout(function(){
			cb(new Error('Su-exec should be initialized before using.'));
		}, 0);
		return;
	}
	if(typeof(options) === 'function') cb = options;

	var strs = [ file, options.stdin || '/dev/null', options.stdout || '/dev/null', options.stderr || '/dev/null' ].concat(argv);
	reqQueue.push(cb);

	var bufs = [];
	var emptyBuf = new Buffer(1);
	emptyBuf[0] = 0;
	var endBuf = new Buffer(1);
	endBuf[0] = 127;
	for(var i=0; i<strs.length; i++) {
		bufs.push( new Buffer(strs[i]) );
		bufs.push( emptyBuf );
	}
	bufs.push(endBuf);
	rootProc.stdin.write(Buffer.concat(bufs));
};

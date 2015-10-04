'use strict';

var childProcess = require('child_process');

var rootProc = null;
var reqQueue = [];
var cbMap = {};

exports.destroy = function(){
	var rp = rootProc;
	rootProc = null;
	rp.stdin.end();
};

exports.init = function(){
	if(rootProc) return;

	// start root daemon
	if(process.getuid() !== 0) {
		throw('Su-exec module should be initialized with root privilege.');
	}
	rootProc = childProcess.execFile(__dirname + '/build/Release/su-exec');

	// error handling
	rootProc.on('error', function(){
		rootProc = null;
	});
	rootProc.once('exit', function(){
		// quit current process if root process is killed
		if(rootProc) process.exit();
	});

	rootProc.stdout.on('data', function(buf){
		var prev = 0;
		for(var i=0; i<buf.length; i++) {
			if(buf[i] !== '|') continue;
			var str = buf.slice(prev, i).toString('utf8');
			prev = i+1;
			if(str.charAt(0) === '+') {
				// new process
				var pid = str.slice(1);
				if(cbMap[pid]) {
					reqQueue.shift().apply(global, cbMap[pid]);
					delete cbMap[pid];
				} else {
					cbMap[pid] = reqQueue.shift();
				}
			} else if(str.charAt(0) === '-') {
				// end process
				var info = str.split('-');
				var err = null;
				if(Number(info[2])) err = new Error('Su-exec failed to execute.');
				if(cbMap[info[1]]) {
					cbMap[info[1]](err, Number(info[3]), Number(info[4]));
					delete cbMap[info[1]];
				} else {
					cbMap[info[1]] = [err, Number(info[3]), Number(info[4])];
				}
			}
		}
	});
};

var exec = function(type, file, argv, options, cb){
	if(!rootProc) {
		setTimeout(function(){
			cb(new Error('Su-exec should be initialized before using.'));
		}, 0);
		return;
	}
	if(typeof(options) === 'function') {
		cb = options;
		options = {};
	}
	if(typeof(cb) !== 'function') {
		cb = function(){};
		options = {};
	}

	var strs = [ type, file, options.stdin || '/dev/null', options.stdout || '/dev/null', options.stderr || '/dev/null' ].concat(argv);
	reqQueue.push(cb);

	var bufs = [];
	var emptyBuf = new Buffer(1);
	emptyBuf[0] = 0;
	var endBuf = new Buffer(1);
	endBuf[0] = 127;
	for(var i=0; i<strs.length; i++) {
		bufs.push( new Buffer(strs[i].replace(/[\0\x7F]/g, '')) );
		bufs.push( emptyBuf );
	}
	bufs.push(endBuf);
	rootProc.stdin.write(Buffer.concat(bufs));
};

exports.execFile = function(file, argv, options, cb){
	exec('f', file, argv, options, cb);
};

exports.execPath = function(file, argv, options, cb){
	exec('p', file, argv, options, cb);
};

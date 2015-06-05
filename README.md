# su-exec #

This linux node.js module make it simple to execute outer executable with root privilege, similar to `sudo`.

This module requires root when initializing, so your app should be started as root.
Do NOT forget to drop root privilege using `process.setuid()` and `process.setgid()`.

It keeps a tiny background process to get root privilege, living with the current node process.

## How to Use ##

Install with `npm install su-exec`.

It should be initialized with `suExec.init()` once before used. The node process should has root privilege at that moment.

Then exec with `suExec.execFile(file, argv, options, cb)`, or `suExec.execPath(file, argv, options, cb)`.
The `execPath` method could search executables in PATH (just like what shell does).

```js
var suExec = require('su-exec');

suExec.init();

process.setgid('nogroup');
process.setuid('nobody');

suExec.execFile('/usr/bin/whoami', ['/usr/bin/whoami'], {
	stdin: '/dev/null',
	stdout: '/dev/null',
	stderr: '/dev/null'
}, function(err, status, signal){
	// execute when child exit
});
```

Available options are `stdin`, `stdout`, and `stderr`, indicating the files which should be redirected.
They are "/dev/null" by default.

## LICENSE ##

MIT

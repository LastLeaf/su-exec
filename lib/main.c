#define _GNU_SOURCE

#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <errno.h>

#define REQ_LEN_MAX 32768

void childSig(){
	int pid, status, exit = 0, sig = 0;
	char str[32];

	while( (pid = waitpid(-1, &status, WNOHANG)) > 0 ){
		if(WIFEXITED(status)) exit = WEXITSTATUS(status);
		if(WIFSIGNALED(status)) sig = WTERMSIG(status);
		sprintf(str, "-%d-0-%d-%d|", pid, exit, sig);
		if( write(STDOUT_FILENO, str, strlen(str)) ){};
	}
}

void childProc(char* req, int reqc, int errPipe){
	int i, spc = 0, in, out, err;
	char* sp[REQ_LEN_MAX+1];

	sp[0] = req;
	for(i=1; i<reqc; i++) {
		if(!req[i-1]) sp[spc++] = req + i;
	}
	sp[spc] = NULL;

	// redirect
	close(STDIN_FILENO);
	close(STDOUT_FILENO);
	close(STDERR_FILENO);
	in = open(sp[1], O_RDONLY);
	out = open(sp[2], O_WRONLY|O_CREAT|O_TRUNC, 0644);
	err = open(sp[3], O_WRONLY|O_CREAT|O_TRUNC, 0644);
	if(in == -1 || out == -1 || err == -1) {
		if(write(errPipe, "ERR\0", 4)) {}
		_exit(0);
	}
	dup2(in, STDIN_FILENO);
	dup2(out, STDOUT_FILENO);
	dup2(err, STDERR_FILENO);

	// exec
	if(req[0] == 'p') execvp(sp[0], sp+4);
	else execv(sp[0], sp+4);

	if( write(errPipe, "ERR\0", 4) ){};
	_exit(0);
}

void newReq(char* req, int reqc){
	char str[16];
	int pid, pipe[2];

	if(req == NULL) {
		if( write(STDOUT_FILENO, "+0|", 3) ){};
		if( write(STDOUT_FILENO, "-0-1-0-0|", 9) ){};
		return;
	}
	if(pipe2(pipe, O_CLOEXEC)) {
		if( write(STDOUT_FILENO, "+0|", 3) ){};
		if( write(STDOUT_FILENO, "-0-1-0-0|", 9) ){};
		return;
	}

	pid = fork();
	if(pid < 0) {
		if( write(STDOUT_FILENO, "+0|", 3) ){};
		if( write(STDOUT_FILENO, "-0-1-0-0|", 9) ){};
		return;
	}
	if(!pid) {
		close(pipe[0]);
		childProc(req, reqc, pipe[1]);
		return;
	}

	close(pipe[1]);
	if(read(pipe[0], str, 4) > 0) {
		if( write(STDOUT_FILENO, "+0|", 3) ){};
		if( write(STDOUT_FILENO, "-0-1-0-0|", 9) ){};
		return;
	}
	sprintf(str, "+%d|", pid);
	if( write(STDOUT_FILENO, str, strlen(str)) ){};
}

int main(){
	char req[REQ_LEN_MAX];
	char buf[REQ_LEN_MAX];
	int c, i, prev, reqc = 0;

	signal(SIGCHLD, childSig);

	while( (c = read(STDIN_FILENO, buf, REQ_LEN_MAX)) ){
		if(c < 0) {
			if(errno == EINTR) continue;
			break;
		}
		prev = 0;
		for(i=0; i<c; i++) {
			if(buf[i] == '\x7F') {
				if(reqc + i - prev > REQ_LEN_MAX) newReq(NULL, 0);
				else {
					memcpy(req+reqc, buf+prev, i-prev);
					reqc += i-prev;
					newReq(req, reqc);
					reqc = 0;
				}
				prev = i+1;
			}
		}
		if(reqc) reqc = REQ_LEN_MAX + 1;
		else if(i > prev) {
			memcpy(req, buf+prev, i-prev);
			reqc += i-prev;
		}
	}

	return 0;
}

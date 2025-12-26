import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check if running in pkg packaged environment
const isPkg = typeof process.pkg !== 'undefined';

// Buffer size warning threshold (no limit, just warning)
const BUFFER_WARNING_SIZE = 50 * 1024 * 1024; // 50MB warning

class antigravityRequester {
    constructor(options = {}) {
        this.binPath = options.binPath;
        this.executablePath = options.executablePath || this._getExecutablePath();
        this.proc = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.buffer = '';
        this.writeQueue = Promise.resolve();
        this.bufferWarned = false;
    }

    _getExecutablePath() {
        const platform = os.platform();
        const arch = os.arch();

        let filename;
        if (platform === 'win32' && arch === "x64") {
            filename = 'antigravity_requester_windows_amd64.exe';
        } else if (platform === 'android' && arch === "arm64") {
            filename = 'antigravity_requester_android_arm64';
        } else if (platform === 'linux' && arch === "x64") {
            filename = 'antigravity_requester_linux_amd64';
        } else if (platform === 'linux' && arch === "arm64") {
            // Linux ARM64 (Termux, Raspberry Pi, etc.)
            filename = 'antigravity_requester_android_arm64';
        } else {
            throw new Error(`Unsupported platform: ${platform}+${arch}`);
        }

        // Get bin directory path
        // In pkg environment, prioritize the bin directory next to the executable
        let binPath = this.binPath;
        if (!binPath) {
            if (isPkg) {
                // pkg environment: prioritize bin directory next to the executable
                const exeDir = path.dirname(process.execPath);
                const exeBinDir = path.join(exeDir, 'bin');
                if (fs.existsSync(exeBinDir)) {
                    binPath = exeBinDir;
                } else {
                    // Secondly, use bin directory in current working directory
                    const cwdBinDir = path.join(process.cwd(), 'bin');
                    if (fs.existsSync(cwdBinDir)) {
                        binPath = cwdBinDir;
                    } else {
                        // Finally, use bin directory inside the package
                        binPath = path.join(__dirname, 'bin');
                    }
                }
            } else {
                // Development environment
                binPath = path.join(__dirname, 'bin');
            }
        }

        const requester_execPath = path.join(binPath, filename);

        // Check if file exists
        if (!fs.existsSync(requester_execPath)) {
            console.warn(`Binary not found at: ${requester_execPath}`);
        }

        // Set execution permissions (non-Windows platforms)
        if (platform !== 'win32') {
            try {
                fs.chmodSync(requester_execPath, 0o755);
            } catch (error) {
                console.warn(`Could not set executable permissions: ${error.message}`);
            }
        }
        return requester_execPath;
    }

    _ensureProcess() {
        if (this.proc) return;

        this.proc = spawn(this.executablePath, [], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Set stdin to non-blocking mode
        if (this.proc.stdin.setDefaultEncoding) {
            this.proc.stdin.setDefaultEncoding('utf8');
        }

        // Increase stdout buffer to reduce backpressure
        if (this.proc.stdout.setEncoding) {
            this.proc.stdout.setEncoding('utf8');
        }

        // Use setImmediate to process data asynchronously, avoid blocking
        this.proc.stdout.on('data', (data) => {
            const chunk = data.toString();

            // Buffer size monitoring (warning only, no limit, image responses can be large)
            if (!this.bufferWarned && this.buffer.length > BUFFER_WARNING_SIZE) {
                console.warn(`AntigravityRequester: Large buffer (${Math.round(this.buffer.length / 1024 / 1024)}MB), possibly a large response`);
                this.bufferWarned = true;
            }

            this.buffer += chunk;

            // Use setImmediate to process asynchronously, avoid blocking stdout reading
            setImmediate(() => {
                let start = 0;
                let end;

                // Efficient line splitting (avoid creating many strings with split)
                while ((end = this.buffer.indexOf('\n', start)) !== -1) {
                    const line = this.buffer.slice(start, end).trim();
                    start = end + 1;

                    if (!line) continue;

                    try {
                        const response = JSON.parse(line);
                        const pending = this.pendingRequests.get(response.id);
                        if (!pending) continue;

                        if (pending.streamResponse) {
                            pending.streamResponse._handleChunk(response);
                            if (response.type === 'end' || response.type === 'error') {
                                this.pendingRequests.delete(response.id);
                            }
                        } else {
                            this.pendingRequests.delete(response.id);
                            if (response.ok) {
                                pending.resolve(new antigravityResponse(response));
                            } else {
                                pending.reject(new Error(response.error || 'Request failed'));
                            }
                        }
                    } catch (e) {
                        // Ignore JSON parsing errors (possibly incomplete line)
                    }
                }

                // Keep unprocessed part
                this.buffer = start < this.buffer.length ? this.buffer.slice(start) : '';
                this.bufferWarned = false;
            });
        });

        this.proc.stderr.on('data', (data) => {
            console.error('antigravityRequester stderr:', data.toString());
        });

        this.proc.on('close', () => {
            this.proc = null;
            for (const [id, pending] of this.pendingRequests) {
                if (pending.reject) {
                    pending.reject(new Error('Process closed'));
                } else if (pending.streamResponse && pending.streamResponse._onError) {
                    pending.streamResponse._onError(new Error('Process closed'));
                }
            }
            this.pendingRequests.clear();
        });
    }

    async antigravity_fetch(url, options = {}) {
        this._ensureProcess();

        const id = `req-${++this.requestId}`;
        const request = {
            id,
            url,
            method: options.method || 'GET',
            headers: options.headers,
            body: options.body,
            timeout_ms: options.timeout || 30000,
            proxy: options.proxy,
            response_format: 'text',
            ...options
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this._writeRequest(request);
        });
    }

    antigravity_fetchStream(url, options = {}) {
        this._ensureProcess();

        const id = `req-${++this.requestId}`;
        const request = {
            id,
            url,
            method: options.method || 'GET',
            headers: options.headers,
            body: options.body,
            timeout_ms: options.timeout || 30000,
            proxy: options.proxy,
            stream: true,
            ...options
        };

        const streamResponse = new StreamResponse(id);
        this.pendingRequests.set(id, { streamResponse });
        this._writeRequest(request);

        return streamResponse;
    }

    _writeRequest(request) {
        this.writeQueue = this.writeQueue.then(() => {
            return new Promise((resolve, reject) => {
                const data = JSON.stringify(request) + '\n';
                const canWrite = this.proc.stdin.write(data);
                if (canWrite) {
                    resolve();
                } else {
                    // Wait for drain event and remove the other listener when either is triggered
                    const onDrain = () => {
                        this.proc.stdin.removeListener('error', onError);
                        resolve();
                    };
                    const onError = (err) => {
                        this.proc.stdin.removeListener('drain', onDrain);
                        reject(err);
                    };
                    this.proc.stdin.once('drain', onDrain);
                    this.proc.stdin.once('error', onError);
                }
            });
        }).catch(err => {
            console.error('Write request failed:', err);
        });
    }

    close() {
        if (this.proc) {
            // Reject all pending requests
            for (const [id, pending] of this.pendingRequests) {
                if (pending.reject) {
                    pending.reject(new Error('Requester closed'));
                } else if (pending.streamResponse && pending.streamResponse._onError) {
                    pending.streamResponse._onError(new Error('Requester closed'));
                }
            }
            this.pendingRequests.clear();

            // Clear buffer
            this.buffer = '';

            const proc = this.proc;
            this.proc = null;

            // Close stdin
            try {
                proc.stdin.end();
            } catch (e) {
                // Ignore closing error
            }

            // Send SIGTERM immediately to terminate sub-process, do not use setTimeout
            // This ensures sub-process is terminated before main process exits
            try {
                if (proc && !proc.killed) {
                    proc.kill('SIGTERM');
                }
            } catch (e) {
                // Ignore error
            }

            // If SIGTERM is ineffective, use SIGKILL immediately
            try {
                if (proc && !proc.killed) {
                    proc.kill('SIGKILL');
                }
            } catch (e) {
                // Ignore error
            }
        }
    }
}

class StreamResponse {
    constructor(id) {
        this.id = id;
        this.status = null;
        this.statusText = null;
        this.headers = null;
        this.chunks = [];
        this._onStart = null;
        this._onData = null;
        this._onEnd = null;
        this._onError = null;
        this._ended = false;
        this._error = null;
        this._textPromiseResolve = null;
        this._textPromiseReject = null;
    }

    _handleChunk(chunk) {
        if (chunk.type === 'start') {
            this.status = chunk.status;
            this.headers = new Map(Object.entries(chunk.headers || {}));
            if (this._onStart) this._onStart({ status: chunk.status, headers: this.headers });
        } else if (chunk.type === 'data') {
            const data = chunk.encoding === 'base64'
                ? Buffer.from(chunk.data, 'base64').toString('utf8')
                : chunk.data;
            this.chunks.push(data);
            if (this._onData) this._onData(data);
        } else if (chunk.type === 'end') {
            this._ended = true;
            if (this._textPromiseResolve) this._textPromiseResolve(this.chunks.join(''));
            if (this._onEnd) this._onEnd();
        } else if (chunk.type === 'error') {
            this._ended = true;
            this._error = new Error(chunk.error);
            if (this._textPromiseReject) this._textPromiseReject(this._error);
            if (this._onError) this._onError(this._error);
        }
    }

    onStart(callback) {
        this._onStart = callback;
        return this;
    }

    onData(callback) {
        this._onData = callback;
        return this;
    }

    onEnd(callback) {
        this._onEnd = callback;
        return this;
    }

    onError(callback) {
        this._onError = callback;
        return this;
    }

    async text() {
        if (this._ended) {
            if (this._error) throw this._error;
            return this.chunks.join('');
        }
        return new Promise((resolve, reject) => {
            this._textPromiseResolve = resolve;
            this._textPromiseReject = reject;
        });
    }
}

class antigravityResponse {
    constructor(response) {
        this._response = response;
        this.ok = response.ok;
        this.status = response.status;
        this.statusText = response.status_text;
        this.url = response.url;
        this.headers = new Map(Object.entries(response.headers || {}));
        this.redirected = response.redirected;
    }

    async text() {
        if (this._response.body_encoding === 'base64') {
            return Buffer.from(this._response.body, 'base64').toString('utf8');
        }
        return this._response.body;
    }

    async json() {
        const text = await this.text();
        return JSON.parse(text);
    }

    async buffer() {
        if (this._response.body_encoding === 'base64') {
            return Buffer.from(this._response.body, 'base64');
        }
        return Buffer.from(this._response.body, 'utf8');
    }
}

export default antigravityRequester;

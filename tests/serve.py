"""Quiet local test server with enough pending connections for browser workers."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

class Server(ThreadingHTTPServer):
    request_queue_size = 128

Server(('127.0.0.1', 8001), Handler).serve_forever()

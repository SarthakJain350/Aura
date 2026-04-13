import http.server
import socketserver

PORT = 8888

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Intercept Spotify OAuth /callback and redirect securely back to index with payload
        if self.path.startswith('/callback'):
            query_string = ""
            if '?' in self.path:
                query_string = "?" + self.path.split('?', 1)[1]
                
            self.send_response(302)
            self.send_header('Location', f'/{query_string}')
            self.end_headers()
            return

        if self.path.startswith('/model/'):
            import os
            filepath = '.' + self.path
            if os.path.exists(filepath):
                self.send_response(200)
                if filepath.endswith('.json'):
                    self.send_header('Content-type', 'application/json')
                elif filepath.endswith('.bin'):
                    self.send_header('Content-type', 'application/octet-stream')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                with open(filepath, 'rb') as file: 
                    self.wfile.write(file.read())
            else:
                self.send_error(404, "File not found")
            return
            
        super().do_GET()

    def end_headers(self):
        # Disable caching to ensure hot reloads load latest files
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

# Ensuring correct MIME types for browsers so they don't block .js / .jsx
http.server.SimpleHTTPRequestHandler.extensions_map['.js'] = 'application/javascript'
http.server.SimpleHTTPRequestHandler.extensions_map['.jsx'] = 'application/javascript'

Handler = CustomHTTPRequestHandler

try:
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Serving AURA locally at http://127.0.0.1:{PORT}")
        httpd.serve_forever()
except OSError as e:
    print(f"Error starting server: {e}")

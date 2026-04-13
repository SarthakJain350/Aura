import socket
import webbrowser
import time
import subprocess
import sys

def check_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

if __name__ == '__main__':
    print("Booting AURA System...")
    
    # Auto-kill any process already using port 8888 instead of erroring out
    if check_port(8888):
        print("[INFO] Port 8888 is in use — killing old process automatically...")
        try:
            # Windows: find and kill the PID on port 8888
            result = subprocess.run(
                ["powershell", "-Command",
                 "Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"],
                capture_output=True, text=True
            )
            pid = result.stdout.strip()
            if pid:
                subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
                print(f"[INFO] Killed old AURA process (PID {pid})")
                time.sleep(1)
        except Exception as e:
            print(f"[WARNING] Could not auto-kill port process: {e}")
            print("Please close whatever app is using port 8888 and try again.")
            sys.exit(1)


    print("Spawning internal Python HTTP server on port 8888...")
    proc = subprocess.Popen(["python", "server.py"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)

    print("\nAURA Server Online!")
    print("Launching interface in default browser: http://127.0.0.1:8888")
    webbrowser.open("http://127.0.0.1:8888")

    try:
        proc.wait()
    except KeyboardInterrupt:
        print("\nShutting down AURA server. Goodbye!")
        proc.terminate()

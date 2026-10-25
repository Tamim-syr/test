import json, subprocess, sys
FC = "/tmp/claude-0/-home-user-test/478ae8c0-2492-55cb-9e31-616ef7cceb66/scratchpad/ext/filmcraft/target/release/filmcraft-cli"
class MCP:
    def __init__(self):
        self.p = subprocess.Popen([FC, "mcp"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1); self.i = 0
        self.req("initialize", {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "x", "version": "1"}})
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n"); self.p.stdin.flush()
    def req(self, m, params):
        self.i += 1; self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": self.i, "method": m, "params": params}) + "\n"); self.p.stdin.flush()
        while True:
            l = self.p.stdout.readline()
            if not l: raise RuntimeError("mcp closed")
            d = json.loads(l)
            if d.get("id") == self.i: return d
if __name__ == "__main__":
    m = MCP(); t = m.req("tools/list", {})
    for x in t["result"]["tools"]: print(x["name"], "|", x.get("description", "")[:120], "|", json.dumps(x.get("inputSchema", {}).get("properties", {}))[:200])

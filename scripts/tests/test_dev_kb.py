"""Exercise the KB launcher with disposable HTTP services, never the real vault."""
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import unittest

from test_dev_processes import manager

SCRIPTS = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which('bun'), 'Bun is required for KB launcher tests')
class KBLauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='kb launcher ')
        self.root = Path(self.temp.name).resolve()
        (self.root / 'scripts').mkdir()
        for name in ['dev-kb.ts', 'dev-processes.py']:
            shutil.copy2(SCRIPTS / name, self.root / 'scripts' / name)
        companion = self.root / 'apps/companion/src/main.ts'
        web = self.root / 'apps/web/node_modules/next/dist/bin/next'
        for path in [companion, web]:
            path.parent.mkdir(parents=True, exist_ok=True)
        companion.write_text('''
const port = Number(process.env.KB_COMPANION_PORT);
await Bun.write("companion.json", JSON.stringify({pid: process.pid, port,
  origins: process.env.KB_ALLOWED_ORIGINS}));
const server = Bun.serve({hostname: "127.0.0.1", port,
  fetch(req) { return new Response("ok", {status:
    req.headers.get("authorization") === `Bearer ${process.env.KB_COMPANION_TOKEN}` ? 200 : 401}); }});
process.on("SIGTERM", () => { server.stop(true); process.exit(0); });
''')
        web.write_text('''
if (process.env.KB_TEST_WEB_FAIL) process.exit(1);
const port = Number(process.argv[process.argv.indexOf("--port") + 1]);
await Bun.write("web.json", JSON.stringify({pid: process.pid, port,
  companion: process.env.KB_COMPANION_URL}));
const server = Bun.serve({hostname: "127.0.0.1", port, fetch() { return new Response("ok"); }});
console.log("Ready in 1ms");
process.on("SIGTERM", () => { server.stop(true); process.exit(0); });
''')
        self.processes = []
        self.sockets = []
        self.logs = []

    def tearDown(self):
        for proc in reversed(self.processes):
            if proc.poll() is None:
                proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
        for sock in self.sockets:
            sock.close()
        for log in self.logs:
            log.close()
        self.temp.cleanup()

    def reserve(self, port=0):
        sock = socket.socket()
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sockets.append(sock)
        sock.bind(('127.0.0.1', port))
        sock.listen()
        return sock

    def launch(self, defaults=False, **overrides):
        env = {k: v for k, v in os.environ.items() if not k.startswith('KB_')}
        if not defaults:
            ports = [self.reserve(), self.reserve()]
            env['KB_WEB_PORT'] = str(ports[0].getsockname()[1])
            env['KB_COMPANION_PORT'] = str(ports[1].getsockname()[1])
            for sock in ports:
                sock.close()
        env.update(overrides)
        log = (self.root / 'launcher.log').open('w')
        self.logs.append(log)
        proc = subprocess.Popen(['bun', 'scripts/dev-kb.ts'], cwd=self.root,
                                env=env, stdout=log, stderr=log)
        self.processes.append(proc)
        return proc

    def output(self):
        return (self.root / 'launcher.log').read_text()

    def ready(self, proc):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if 'Knowledge Base →' in self.output():
                return
            if proc.poll() is not None:
                self.fail(self.output())
            time.sleep(.05)
        self.fail(self.output())

    def test_replaces_verified_starter_web_and_preserves_foreign_server(self):
        foreign = self.root / 'other-app'
        foreign.mkdir()
        for cwd in [self.root, foreign]:
            self.processes.append(subprocess.Popen(['sleep', '300'], cwd=cwd))
        starter, outsider = self.processes
        manager.track(self.root, 'next-web', starter.pid)
        (self.root / '.dev-pids').write_text(f'next-web:{starter.pid}\n')
        launcher = self.launch()
        self.ready(launcher)
        self.assertIsNotNone(starter.poll())
        self.assertIsNone(outsider.poll())
        companion = json.loads((self.root / 'companion.json').read_text())
        web = json.loads((self.root / 'apps/web/web.json').read_text())
        self.assertEqual(web['companion'], f"http://127.0.0.1:{companion['port']}")
        self.assertIn(f"http://127.0.0.1:{web['port']}", companion['origins'])
        launcher.send_signal(signal.SIGINT)
        self.assertEqual(launcher.wait(timeout=10), 0)
        self.assertFalse(manager.identity(companion['pid']))
        self.assertFalse(manager.identity(web['pid']))
        self.assertIsNone(outsider.poll())

    def test_explicit_busy_port_fails_before_starting_companion(self):
        occupied = self.reserve()
        launcher = self.launch(KB_WEB_PORT=str(occupied.getsockname()[1]))
        self.assertNotEqual(launcher.wait(timeout=10), 0)
        self.assertIn('unavailable', self.output())
        self.assertFalse((self.root / 'companion.json').exists())

    def test_default_ports_skip_foreign_listeners(self):
        try:
            self.reserve(3001)
            self.reserve(4317)
        except OSError:
            self.skipTest('Default ports already occupied by local services')
        launcher = self.launch(defaults=True)
        self.ready(launcher)
        companion = json.loads((self.root / 'companion.json').read_text())
        web = json.loads((self.root / 'apps/web/web.json').read_text())
        self.assertNotEqual(web['port'], 3001)
        self.assertNotEqual(companion['port'], 4317)
        self.assertIn(f"Companion → http://127.0.0.1:{companion['port']}", self.output())

    def test_web_failure_stops_companion_and_returns_failure(self):
        launcher = self.launch(KB_TEST_WEB_FAIL='1')
        self.assertEqual(launcher.wait(timeout=10), 1)
        companion = json.loads((self.root / 'companion.json').read_text())
        self.assertFalse(manager.identity(companion['pid']))
        self.assertNotIn('Knowledge Base →', self.output())

    def test_untracked_build_lock_is_left_alone(self):
        lock = self.root / 'apps/web/.next/dev/lock'
        lock.parent.mkdir(parents=True)
        with lock.open('w'):
            launcher = self.launch()
            self.assertNotEqual(launcher.wait(timeout=10), 0)
            self.assertIn('original terminal', self.output())
            self.assertFalse((self.root / 'companion.json').exists())
            self.assertTrue(lock.exists())


if __name__ == '__main__':
    unittest.main()

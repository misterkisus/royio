// pm2 process definition for РОЙ.IO.
// IMPORTANT: fork mode, single instance. The simulation lives in process memory (lobbies,
// swarms) — cluster mode would split state across workers and break the game. Scale by
// running more single-instance lobbies on different ports behind the proxy if ever needed.
module.exports = {
  apps: [{
    name: 'roy',
    script: 'server.js',
    cwd: __dirname,
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M',
    env: {
      PORT: 3007,            // internal only (behind nginx). 3001 was taken; verify with: ss -ltnp | grep 3007
      NODE_ENV: 'production',
    },
  }],
};

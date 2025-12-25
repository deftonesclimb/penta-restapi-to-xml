module.exports = {
  apps: [{
    name: 'penta-entegra-xml',
    script: 'index.js',
    autorestart: true,
    watch: false,
    max_restarts: 999999,      // Pratik olarak sonsuz restart
    min_uptime: 1000,          // 1 saniye çalışırsa "stable" say
    restart_delay: 5000,       // Restart arası 5 saniye bekle
    env: {
      NODE_ENV: 'production'
    }
  }]
};

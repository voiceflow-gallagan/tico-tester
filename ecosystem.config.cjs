module.exports = {
  apps: [
    {
      name: 'tico-tester',
      script: 'app.js',
      env_production: {
        PORT: 4031,
        NODE_ENV: 'production',
      },
      watch: false,
    },
  ],
}

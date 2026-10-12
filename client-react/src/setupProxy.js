const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      // Все запросы /api с фронтенда проксируем в FastAPI backend
      target: 'http://localhost:8000',
      changeOrigin: true,
    })
  );
};
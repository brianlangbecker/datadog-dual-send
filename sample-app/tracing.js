// Initialize DataDog tracing
const tracer = require('dd-trace').init({
  service: 'sample-app',
  env: 'demo',
  hostname: process.env.DD_AGENT_HOST || 'localhost',
  port: process.env.DD_TRACE_AGENT_PORT || 8126,
  logInjection: true
});

module.exports = { tracer };
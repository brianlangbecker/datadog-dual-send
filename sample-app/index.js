// Initialize tracing before importing other modules
require('./tracing');

const express = require('express');
const StatsD = require('hot-shots');

const app = express();
const port = process.env.PORT || 3000;

// Initialize StatsD client for DataDog metrics
const dogstatsd = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: process.env.DD_DOGSTATSD_PORT || 8125,
  prefix: 'sample.app.',
  tags: ['environment:demo', 'service:sample-app']
});

// Middleware to track request metrics
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Send metrics to DataDog StatsD
    dogstatsd.increment('requests.count', 1, [`method:${req.method}`, `status:${res.statusCode}`]);
    dogstatsd.timing('requests.duration', duration, [`method:${req.method}`]);
  });
  
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'DataDog to Honeycomb Pipeline Demo',
    timestamp: new Date().toISOString(),
    service: 'sample-app'
  });
});

app.get('/health', (req, res) => {
  dogstatsd.increment('health.check');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/metrics', (req, res) => {
  // Simulate some business metrics
  dogstatsd.gauge('business.active_users', Math.floor(Math.random() * 1000));
  dogstatsd.histogram('business.order_value', Math.random() * 500);
  
  res.json({ message: 'Metrics sent to DataDog StatsD' });
});

app.get('/error', (req, res) => {
  dogstatsd.increment('errors.count', 1, ['type:simulated']);
  res.status(500).json({ error: 'Simulated error for testing' });
});

app.get('/slow', async (req, res) => {
  const delay = Math.random() * 2000 + 500; // 500ms to 2.5s
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  dogstatsd.timing('slow.request.duration', delay);
  res.json({ message: 'Slow response', delay: `${delay}ms` });
});

// Generate some background activity
setInterval(() => {
  dogstatsd.gauge('system.cpu_usage', Math.random() * 100);
  dogstatsd.gauge('system.memory_usage', Math.random() * 100);
  dogstatsd.increment('background.heartbeat');
}, 10000);

app.listen(port, () => {
  console.log(`Sample app listening on port ${port}`);
  dogstatsd.increment('app.started');
});
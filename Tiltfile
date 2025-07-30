# Load environment variables
load('ext://dotenv', 'dotenv')
dotenv()

# Use Docker Compose for services
docker_compose('./docker-compose.yml')

# Build sample app with live reload
docker_build(
    'datadog-otel-pipeline_sample-app',
    './sample-app',
    live_update=[
        sync('./sample-app/', '/app/'),
        run('npm install', trigger=['./sample-app/package.json'])
    ]
)

# Watch for config changes and restart collector
local_resource(
  'config-watcher',
  'echo "Config file changed - restart otel-collector service"',
  deps=['otel-collector-config.yaml'],
  auto_init=False,
  trigger_mode=TRIGGER_MODE_AUTO
)
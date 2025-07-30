# DataDog to Honeycomb Pipeline Demo

> **Note**: This is a stop-gap solution before moving to OpenTelemetry agents. DataDog agents can be overly chatty, and the OpenTelemetry Collector is still highly recommended for production use.

This project demonstrates two methods for using OpenTelemetry Collector to receive telemetry data from DataDog applications and route it to different destinations based on your observability strategy.

## Dual-Path Architecture

This setup provides two distinct data paths:

### Method 1: Full Dual Shipping (DD + Honeycomb) ✅ TESTED & WORKING

```
DataDog App/Agent → OTel Collector (ports 8125/8126) → DataDog + Honeycomb
```

**Status**: Successfully tested - traces and metrics flowing to Honeycomb. DataDog export is configured but commented out in the collector config. To enable dual shipping to DataDog, uncomment the DataDog exporter in `otel-collector-config.yaml` and add your DataDog API key.

**Alternative**: OpenTelemetry can be used in place of the DataDog agent for dual send, providing better control over telemetry data and reducing chattiness.

### Method 2: Honeycomb-Only Path (Collector config tested)

```
DataDog App/Agent → OTel Collector (ports 8135/8136) → Honeycomb Only
```

Both methods use DataDog receiver protocols but offer different export destinations, allowing you to optimize costs and data routing without changing your application instrumentation.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

## Setup


1. **Clone and navigate to the project:**

   ```bash
   cd datadog-otel-pipeline
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env with your API keys:
   # HONEYCOMB_API_KEY=your_honeycomb_api_key
   # DATADOG_API_KEY=your_datadog_api_key (only needed for Method 1 dual shipping)
   ```

3. **Start the services:**

   ```bash
   # Method 1: Start sample app + OTel collector (recommended)
   docker-compose up sample-app otel-collector --build -d

   # Or start all services including DataDog agent
   docker-compose up --build -d
   ```

   This will:

   - Build the sample application Docker image
   - Start OpenTelemetry Collector on ports 8125/8126 (Method 1) and 8135/8136 (Method 2)
   - Start sample app on port 3000
   - Set up port forwarding for local access
   - Provide a web UI at `http://localhost:10350`

## Services

### Method 1: OpenTelemetry Collector (Full Dual Shipping)

- **DataDog APM Receiver**: `localhost:8126`
- **StatsD Receiver**: `localhost:8125`
- **OTLP gRPC**: `localhost:4317`
- **OTLP HTTP**: `localhost:4318`
- **Metrics endpoint**: `localhost:8888`
- **Exports to**: DataDog + Honeycomb

### Method 2: OpenTelemetry Collector (Honeycomb Only)

- **DataDog APM Receiver**: `localhost:8136`
- **StatsD Receiver**: `localhost:8135`
- **OTLP gRPC**: `localhost:4327`
- **OTLP HTTP**: `localhost:4328`
- **Metrics endpoint**: `localhost:8889`
- **Exports to**: Honeycomb Only

### Sample Application

- **Web interface**: `http://localhost:3000`
- Generates traces and metrics sent to Method 1 collector by default

### DataDog Agent (Optional)

- **APM**: `localhost:8127`
- **StatsD**: `localhost:8124`
- For comparison with direct DataDog integration

## Testing the Pipeline

1. **Generate traffic:**

   ```bash
   # Basic request
   curl http://localhost:3000/

   # Health check
   curl http://localhost:3000/health

   # Generate metrics
   curl http://localhost:3000/metrics

   # Simulate errors
   curl http://localhost:3000/error

   # Slow requests
   curl http://localhost:3000/slow
   ```

2. **Monitor the collectors:**

   ```bash
   # View Method 1 collector metrics
   curl http://localhost:8888/metrics

   # View Method 2 collector metrics
   curl http://localhost:8889/metrics

   # Check collector logs
   docker-compose logs otel-collector
   docker-compose logs otel-collector-method2
   ```

3. **Verify data in Honeycomb:**

   - **Method 1**: Check dataset `datadog-pipeline-demo`
   - **Method 2**: Check dataset `datadog-pipeline-method2`
   - Look for traces and metrics from applications

4. **Verify data in DataDog (Method 1 only):**
   - Check APM traces in DataDog console
   - Look for custom metrics with prefix `sample.app.`

## Configuration Details

### Method 1: Full Dual Shipping (`otel-collector-config.yaml`)

- **Receivers**: DataDog APM (8126), StatsD (8125), OTLP (4317/4318)
- **Exporters**: DataDog + Honeycomb
- **Use Case**: Applications that need data in both systems

### Method 2: Honeycomb-Only (`otel-collector-method2-config.yaml`)

- **Receivers**: DataDog APM (8136), StatsD (8135), OTLP (4327/4328)
- **Exporters**: Honeycomb only
- **Use Case**: Cost optimization, high-volume data, Honeycomb-specific analytics

### DataDog Configuration for Method 2

For Method 2, you want the DataDog Agent to send data to BOTH DataDog and the Honeycomb-only collector using DataDog's dual shipping feature:

#### DataDog Agent Dual Shipping Configuration

Configure your DataDog Agent to send data to both DataDog and Method 2 collector:

```yaml
# datadog.yaml
api_key: 'your-primary-datadog-api-key' # Primary DataDog destination
site: 'datadoghq.com'

# APM traces dual shipping
apm_config:
  additional_endpoints:
    'https://trace-intake.datadoghq.com': # Secondary DataDog org (optional)
      - 'your-secondary-datadog-api-key'
    'http://localhost:8136': # Method 2 collector APM port
      - 'dummy-key' # OTel collector doesn't validate DD API key

# StatsD metrics dual shipping
dogstatsd_config:
  additional_endpoints:
    - host: 'localhost'
      port: 8135 # Method 2 collector StatsD port
```

Or using environment variables:

```bash
# Primary DataDog configuration
DD_API_KEY=your-primary-datadog-api-key
DD_SITE=datadoghq.com

# APM dual shipping
DD_APM_ADDITIONAL_ENDPOINTS='{
  "https://trace-intake.datadoghq.com": ["your-secondary-datadog-api-key"],
  "http://localhost:8136": ["dummy-key"]
}'

# StatsD metrics dual shipping
DD_DOGSTATSD_ADDITIONAL_ENDPOINTS='localhost:8135'
```

**Note**: For the OpenTelemetry collector endpoint (`localhost:8136`), you can use "dummy-key" since the collector doesn't validate DataDog API keys. For actual DataDog endpoints, you need real API keys.

#### Application Configuration (No Changes Needed)

Your applications continue using standard DataDog configuration:

```bash
# Environment Variables (unchanged)
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126  # Standard DD Agent port
DD_DOGSTATSD_PORT=8125    # Standard DD Agent port
```

**Flow**: App → DD Agent (8125/8126) → DataDog + Method 2 Collector (8135/8136) → Honeycomb

**Result**: Data appears in both DataDog AND Honeycomb, with the collector providing the bridge to Honeycomb.

### Processors

- **Batch**: Improves performance by batching telemetry
- **Memory Limiter**: Prevents OOM issues
- **Resource**: Adds common resource attributes

## Troubleshooting

1. **No data in Honeycomb:**

   - Check `HONEYCOMB_API_KEY` is set correctly
   - Verify dataset name in Honeycomb matches config

2. **No data in DataDog:**

   - Check `DATADOG_API_KEY` is set correctly
   - Verify DataDog site configuration

3. **Collector not receiving data:**

   - Check sample app environment variables
   - Verify ports are not conflicting
   - Review collector logs for errors

4. **Debug mode:**
   - The collector includes a debug exporter
   - Check collector logs to see all telemetry data

## File Structure

```
datadog-otel-pipeline/
├── docker-compose.yml                  # Container orchestration
├── otel-collector-config.yaml          # Method 1: Full dual shipping config
├── otel-collector-method2-config.yaml  # Method 2: Honeycomb-only config
├── .env.example                        # Environment template
├── README.md                           # This file
└── sample-app/                         # Sample Node.js application
    ├── Dockerfile
    ├── package.json
    ├── index.js                        # Main application
    └── tracing.js                     # Telemetry initialization
```

## Customization

- **Add more receivers**: Modify collector config files
- **Change export destinations**: Update exporters section in configs
- **Route specific services**: Use processors to filter by service name
- **Modify sample app**: Edit `sample-app/index.js` to test different methods
- **Add processors**: Include additional processing steps

## Use Cases

### Method 1: Full Dual Shipping

- Legacy applications requiring DataDog APM
- Teams transitioning to Honeycomb gradually
- Critical services needing redundant observability
- Compliance requiring data in multiple systems

### Method 2: Honeycomb-Only Path

- High-volume/low-value telemetry data
- Cost optimization for non-critical services
- Honeycomb-specific analytics and querying
- Development/staging environments

This demo provides a foundation for building production telemetry pipelines that bridge DataDog and Honeycomb ecosystems with flexible routing options.

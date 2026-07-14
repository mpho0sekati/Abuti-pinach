-- ============================================================================
-- PHASE 1: Mini-Palantir Analytics Infrastructure for AbUti Spinach
-- Date: 2026-03-31
-- 
-- This migration adds time-series, geospatial, and analytics tables
-- for real-time farm monitoring, predictive modeling, and intelligence
-- ============================================================================

-- ============================================================================
-- 1. ENABLE EXTENSIONS
-- ============================================================================

-- Enable TimescaleDB for time-series data
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis CASCADE;

-- ============================================================================
-- 2. FARMER FIELDS (Geospatial)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.field_geometry (
  field_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  field_name varchar(255) NOT NULL,
  geom geometry(POLYGON, 4326) NOT NULL,
  area_hectares numeric(10, 2),
  crop_type varchar(255),
  soil_type varchar(100),
  slope_percent numeric(5, 2),
  irrigation_type varchar(100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX field_geom_spatial ON public.field_geometry USING GIST (geom);
CREATE INDEX field_farm_id ON public.field_geometry(farm_id);
CREATE INDEX field_created_at ON public.field_geometry(created_at);

ALTER TABLE public.field_geometry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can view their own field geometry" ON public.field_geometry
  FOR SELECT USING (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

CREATE POLICY "Farmers can insert their own field geometry" ON public.field_geometry
  FOR INSERT WITH CHECK (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

CREATE POLICY "Farmers can update their own field geometry" ON public.field_geometry
  FOR UPDATE USING (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

-- ============================================================================
-- 3. IOT SENSOR READINGS (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sensor_readings (
  time timestamptz NOT NULL,
  farm_id uuid NOT NULL,
  field_id uuid NOT NULL REFERENCES public.field_geometry(field_id) ON DELETE CASCADE,
  sensor_id varchar(255) NOT NULL,
  sensor_type varchar(50) NOT NULL,
  value numeric(12, 4) NOT NULL,
  unit varchar(20),
  battery_level numeric(5, 2),
  signal_strength numeric(5, 2),
  created_at timestamptz DEFAULT now()
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable(
  'public.sensor_readings',
  'time',
  if_not_exists => TRUE,
  chunk_time_interval => INTERVAL '1 day'
);

CREATE INDEX sensor_readings_farm_time ON public.sensor_readings (farm_id, time DESC);
CREATE INDEX sensor_readings_field_type_time ON public.sensor_readings (field_id, sensor_type, time DESC);
CREATE INDEX sensor_readings_sensor_id ON public.sensor_readings (sensor_id, time DESC);

ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can read their own sensor data" ON public.sensor_readings
  FOR SELECT USING (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

CREATE POLICY "Sensor systems can insert readings" ON public.sensor_readings
  FOR INSERT WITH CHECK (TRUE); -- Can be restricted to service role

-- ============================================================================
-- 4. SATELLITE IMAGERY & FIELD HEALTH (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.field_health (
  time timestamptz NOT NULL,
  field_id uuid NOT NULL REFERENCES public.field_geometry(field_id) ON DELETE CASCADE,
  farm_id uuid NOT NULL,
  ndvi_avg numeric(5, 3),
  ndvi_std numeric(5, 3),
  ndvi_min numeric(5, 3),
  ndvi_max numeric(5, 3),
  ndvi_raster bytea,
  vegetation_density numeric(5, 2),
  water_stress numeric(5, 2),
  hotspots jsonb,
  cloud_coverage numeric(5, 2),
  satellite_source varchar(50),
  image_url varchar(500),
  created_at timestamptz DEFAULT now()
);

-- Convert to hypertable
SELECT create_hypertable(
  'public.field_health',
  'time',
  if_not_exists => TRUE,
  chunk_time_interval => INTERVAL '1 week'
);

CREATE INDEX field_health_field_time ON public.field_health (field_id, time DESC);
CREATE INDEX field_health_farm_time ON public.field_health (farm_id, time DESC);
CREATE INDEX field_health_created_at ON public.field_health (created_at DESC);

ALTER TABLE public.field_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can read their own field health" ON public.field_health
  FOR SELECT USING (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

-- ============================================================================
-- 5. PREDICTIONS (Cache/Model Outputs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.field_geometry(field_id) ON DELETE CASCADE,
  prediction_type varchar(50) NOT NULL,
  prediction_subtype varchar(50),
  predicted_value numeric(14, 4),
  confidence numeric(5, 2),
  ci_lower numeric(14, 4),
  ci_upper numeric(14, 4),
  generated_at timestamptz DEFAULT now(),
  valid_from timestamptz,
  valid_until timestamptz,
  model_version varchar(50),
  model_name varchar(100),
  input_features jsonb,
  metadata jsonb
);

CREATE INDEX predictions_farm_field ON public.predictions(farm_id, field_id);
CREATE INDEX predictions_type_valid ON public.predictions(prediction_type, valid_until);
CREATE INDEX predictions_generated_at ON public.predictions(generated_at DESC);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can read their own predictions" ON public.predictions
  FOR SELECT USING (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

-- ============================================================================
-- 6. ANOMALIES (Real-Time Alerts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  field_id uuid REFERENCES public.field_geometry(field_id) ON DELETE CASCADE,
  anomaly_type varchar(50) NOT NULL,
  sub_type varchar(100),
  description text NOT NULL,
  severity varchar(20) NOT NULL,
  anomaly_score numeric(5, 3),
  detected_at timestamptz DEFAULT now(),
  acknowledged boolean DEFAULT FALSE,
  acknowledged_at timestamptz,
  acknowledged_by varchar(255),
  resolution text,
  resolved_at timestamptz,
  metric_name varchar(100),
  expected_value numeric(14, 4),
  observed_value numeric(14, 4),
  root_cause varchar(255),
  recommended_action text
);

CREATE INDEX anomalies_farm_time ON public.anomalies(farm_id, detected_at DESC);
CREATE INDEX anomalies_field_time ON public.anomalies(field_id, detected_at DESC);
CREATE INDEX anomalies_unresolved ON public.anomalies(farm_id, resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX anomalies_severity ON public.anomalies(farm_id, severity) WHERE acknowledged = FALSE;

ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can read their own anomalies" ON public.anomalies
  FOR SELECT USING (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

-- ============================================================================
-- 7. RISK ASSESSMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.field_geometry(field_id) ON DELETE CASCADE,
  assessment_date timestamptz DEFAULT now(),
  overall_risk numeric(5, 2),
  yield_risk numeric(5, 2),
  pest_risk numeric(5, 2),
  climate_risk numeric(5, 2),
  financial_risk numeric(5, 2),
  market_risk numeric(5, 2),
  disease_risk numeric(5, 2),
  alert_level varchar(20),
  primary_threat varchar(255),
  recommendations jsonb,
  urgency_score numeric(5, 2),
  model_confidence numeric(5, 2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX risk_assessments_farm_field ON public.risk_assessments(farm_id, field_id);
CREATE INDEX risk_assessments_date ON public.risk_assessments(farm_id, assessment_date DESC);
CREATE INDEX risk_assessments_overall ON public.risk_assessments(farm_id, overall_risk DESC);
CREATE INDEX risk_assessments_high_risk ON public.risk_assessments(farm_id, alert_level) 
  WHERE alert_level IN ('high', 'critical');

ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can read their own risk assessments" ON public.risk_assessments
  FOR SELECT USING (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

-- ============================================================================
-- 8. PEST & DISEASE LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.field_geometry(field_id) ON DELETE CASCADE,
  pest_name varchar(255) NOT NULL,
  pest_type varchar(50),
  severity numeric(3, 0),
  affected_area_percent numeric(5, 2),
  first_detected_at date,
  last_observed_at date,
  notes text,
  treatment_applied varchar(255),
  treatment_date date,
  effectiveness numeric(5, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX pest_logs_farm_field ON public.pest_logs(farm_id, field_id);
CREATE INDEX pest_logs_detected_at ON public.pest_logs(first_detected_at DESC);
CREATE INDEX pest_logs_pest_name ON public.pest_logs(pest_name);

ALTER TABLE public.pest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can read their own pest logs" ON public.pest_logs
  FOR SELECT USING (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

-- ============================================================================
-- 9. MARKET PRICES (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_prices (
  time timestamptz NOT NULL,
  crop varchar(255) NOT NULL,
  region varchar(255),
  country varchar(100),
  price_zar numeric(12, 4),
  price_usd numeric(12, 4),
  unit varchar(20),
  market_name varchar(255),
  source varchar(100),
  volume_tons numeric(10, 2),
  trend varchar(20),
  created_at timestamptz DEFAULT now()
);

-- Convert to hypertable
SELECT create_hypertable(
  'public.market_prices',
  'time',
  if_not_exists => TRUE,
  chunk_time_interval => INTERVAL '1 week'
);

CREATE INDEX market_prices_crop_region_time ON public.market_prices(crop, region, time DESC);
CREATE INDEX market_prices_crop_time ON public.market_prices(crop, time DESC);

-- ============================================================================
-- 10. FIELD RECOMMENDATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.field_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.field_geometry(field_id) ON DELETE CASCADE,
  recommendation_type varchar(50),
  title varchar(255) NOT NULL,
  description text,
  priority varchar(20),
  confidence numeric(5, 2),
  estimated_impact text,
  action_required text,
  deadline date,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  acknowledged boolean DEFAULT FALSE,
  implemented boolean DEFAULT FALSE
);

CREATE INDEX field_recommendations_farm ON public.field_recommendations(farm_id, created_at DESC);
CREATE INDEX field_recommendations_active ON public.field_recommendations(farm_id, expires_at) 
  WHERE expires_at > now();

ALTER TABLE public.field_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can read their own recommendations" ON public.field_recommendations
  FOR SELECT USING (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

-- ============================================================================
-- 11. SCENARIO SIMULATIONS (What-If Analysis)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scenario_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.field_geometry(field_id) ON DELETE CASCADE,
  scenario_name varchar(255) NOT NULL,
  scenario_type varchar(50),
  parameters jsonb NOT NULL,
  projected_yield numeric(12, 4),
  projected_revenue numeric(14, 2),
  projected_risk numeric(5, 2),
  confidence numeric(5, 2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX scenario_simulations_farm ON public.scenario_simulations(farm_id, created_at DESC);

ALTER TABLE public.scenario_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can read their own simulations" ON public.scenario_simulations
  FOR SELECT USING (farm_id IN (SELECT id FROM public.farmers WHERE id = auth.uid()));

-- ============================================================================
-- 12. DATA INGESTION LOGS (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.data_ingestion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type varchar(50),
  source_name varchar(255),
  records_processed integer,
  records_errors integer,
  status varchar(50),
  ingestion_started_at timestamptz,
  ingestion_ended_at timestamptz,
  error_details text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ingestion_logs_source_time ON public.data_ingestion_logs(source_type, created_at DESC);

-- ============================================================================
-- 13. HELPER FUNCTIONS
-- ============================================================================

-- Function to get latest field health for a field
CREATE OR REPLACE FUNCTION get_latest_field_health(field_uuid uuid)
RETURNS TABLE (
  ndvi_avg numeric,
  ndvi_std numeric,
  vegetation_density numeric,
  water_stress numeric,
  cloud_coverage numeric,
  recorded_at timestamptz
) AS $$
  SELECT ndvi_avg, ndvi_std, vegetation_density, water_stress, cloud_coverage, time
  FROM public.field_health
  WHERE field_id = field_uuid
  ORDER BY time DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Function to get unresolved anomalies for a farm
CREATE OR REPLACE FUNCTION get_unresolved_anomalies(farm_uuid uuid)
RETURNS TABLE (
  id uuid,
  anomaly_type varchar,
  severity varchar,
  description text,
  detected_at timestamptz
) AS $$
  SELECT id, anomaly_type, severity, description, detected_at
  FROM public.anomalies
  WHERE farm_id = farm_uuid
    AND resolved_at IS NULL
  ORDER BY detected_at DESC;
$$ LANGUAGE SQL STABLE;

-- Function to calculate days until anomaly becomes critical
CREATE OR REPLACE FUNCTION get_critical_anomalies(farm_uuid uuid)
RETURNS TABLE (
  id uuid,
  severity varchar,
  days_remaining integer,
  urgency varchar
) AS $$
  SELECT 
    id, 
    severity,
    EXTRACT(DAY FROM (detected_at + INTERVAL '7 days' - now()))::integer,
    CASE 
      WHEN EXTRACT(DAY FROM (detected_at + INTERVAL '7 days' - now())) < 2 THEN 'CRITICAL'
      WHEN EXTRACT(DAY FROM (detected_at + INTERVAL '7 days' - now())) < 5 THEN 'HIGH'
      ELSE 'MEDIUM'
    END
  FROM public.anomalies
  WHERE farm_id = farm_uuid
    AND resolved_at IS NULL
    AND severity IN ('high', 'critical')
  ORDER BY days_remaining ASC;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- 14. MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================================

-- Daily sensor statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_sensor_stats AS
SELECT 
  farm_id,
  field_id,
  sensor_type,
  DATE(time) as reading_date,
  ROUND(AVG(value)::numeric, 2) as avg_value,
  ROUND(MIN(value)::numeric, 2) as min_value,
  ROUND(MAX(value)::numeric, 2) as max_value,
  ROUND(STDDEV(value)::numeric, 2) as stddev_value,
  COUNT(*) as reading_count
FROM public.sensor_readings
GROUP BY farm_id, field_id, sensor_type, DATE(time);

CREATE INDEX daily_sensor_stats_farm_date ON public.daily_sensor_stats(farm_id, reading_date DESC);

-- Recent risk summary
CREATE MATERIALIZED VIEW IF NOT EXISTS public.latest_risk_summary AS
SELECT DISTINCT ON (farm_id, field_id)
  farm_id,
  field_id,
  overall_risk,
  alert_level,
  primary_threat,
  assessment_date
FROM public.risk_assessments
ORDER BY farm_id, field_id, assessment_date DESC;

-- ============================================================================
-- 15. DOCUMENTATION & COMMENTS
-- ============================================================================

COMMENT ON TABLE public.field_geometry IS 'Geospatial field boundaries with PostGIS POLYGON geometry';
COMMENT ON TABLE public.sensor_readings IS 'Time-series IoT sensor data (moisture, temperature, humidity, electrical conductivity)';
COMMENT ON TABLE public.field_health IS 'Time-series satellite imagery metrics (NDVI, vegetation density, water stress)';
COMMENT ON TABLE public.predictions IS 'Cached predictions from ML models (yield, pest, price forecasts)';
COMMENT ON TABLE public.anomalies IS 'Real-time detected anomalies with severity and recommendations';
COMMENT ON TABLE public.risk_assessments IS 'Composite risk scores combining multiple risk factors';
COMMENT ON TABLE public.market_prices IS 'Historical commodity prices by crop, region, and market';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created: 10
-- Hypertables created: 3 (sensor_readings, field_health, market_prices)
-- Materialized views created: 2
-- Helper functions created: 3
-- RLS policies configured: TRUE
-- PostGIS & TimescaleDB: ENABLED
--
-- Next steps:
-- 1. Verify hypertables were created: SELECT * FROM timescaledb_information.hypertables;
-- 2. Test RLS policies with a test farmer account
-- 3. Create data ingestion Edge Functions
-- 4. Configure Redis for realtime streams
-- ============================================================================

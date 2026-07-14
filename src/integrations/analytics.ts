/**
 * Analytics Data Types
 * Auto-generated types for Phase 1 analytics tables
 * 
 * These types match the Supabase schema created in:
 * supabase/migrations/20260331144800_phase1_analytics_infrastructure.sql
 */

// ============================================================================
// GEOSPATIAL TYPES
// ============================================================================

export interface FieldGeometry {
  field_id: string;
  farm_id: string;
  field_name: string;
  geom: string; // GeoJSON or WKT format
  area_hectares: number;
  crop_type: string | null;
  soil_type: string | null;
  slope_percent: number | null;
  irrigation_type: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TIME-SERIES TYPES
// ============================================================================

export interface SensorReading {
  time: string; // ISO 8601 timestamp
  farm_id: string;
  field_id: string;
  sensor_id: string;
  sensor_type: 'moisture' | 'temperature' | 'humidity' | 'ec' | 'ph' | 'nitrogen';
  value: number;
  unit: string;
  battery_level: number | null;
  signal_strength: number | null;
  created_at: string;
}

export interface DailySensorStats {
  farm_id: string;
  field_id: string;
  sensor_type: string;
  reading_date: string;
  avg_value: number;
  min_value: number;
  max_value: number;
  stddev_value: number;
  reading_count: number;
}

export interface FieldHealth {
  time: string; // ISO 8601 timestamp
  field_id: string;
  farm_id: string;
  ndvi_avg: number; // Normalized Difference Vegetation Index (0-1)
  ndvi_std: number; // Standard deviation of NDVI
  ndvi_min: number;
  ndvi_max: number;
  ndvi_raster: Uint8Array | null; // Binary raster data
  vegetation_density: number; // 0-100 %
  water_stress: number; // 0-100 %
  hotspots: Hotspot[] | null; // GeoJSON features
  cloud_coverage: number; // 0-100 %
  satellite_source: string; // 'sentinel-2', 'planet-labs', etc
  image_url: string | null; // URL to satellite image
  created_at: string;
}

export interface Hotspot {
  lat: number;
  lng: number;
  severity: 'low' | 'moderate' | 'high';
  type: 'disease' | 'stress' | 'pest' | 'flooding';
}

export interface MarketPrice {
  time: string; // ISO 8601 timestamp
  crop: string;
  region: string | null;
  country: string | null;
  price_zar: number;
  price_usd: number | null;
  unit: string; // 'kg', 'ton', 'bag'
  market_name: string | null;
  source: string; // 'safex', 'local-market', 'farmer-feedback'
  volume_tons: number | null;
  trend: 'rising' | 'falling' | 'stable' | null;
  created_at: string;
}

// ============================================================================
// PREDICTIONS TYPES
// ============================================================================

export interface Prediction {
  id: string;
  farm_id: string;
  field_id: string;
  prediction_type: 'yield' | 'pest' | 'price' | 'weather' | 'disease';
  prediction_subtype: string | null;
  predicted_value: number;
  confidence: number;
  ci_lower: number;
  ci_upper: number;
  generated_at: string;
  valid_from: string | null;
  valid_until: string;
  model_version: string;
  model_name: string | null;
  input_features: Record<string, any> | null;
  metadata: Record<string, any> | null;
}

export interface YieldPrediction extends Prediction {
  prediction_type: 'yield';
  predicted_value: number;
}

export interface PestPrediction extends Prediction {
  prediction_type: 'pest';
  predicted_value: number;
  prediction_subtype: string;
}

export interface PricePrediction extends Prediction {
  prediction_type: 'price';
  predicted_value: number;
  prediction_subtype: string;
}

// ============================================================================
// ANOMALY DETECTION TYPES
// ============================================================================

export interface Anomaly {
  id: string;
  farm_id: string;
  field_id: string | null;
  anomaly_type: 'sensor' | 'health' | 'environmental' | 'pest' | 'market';
  sub_type: string | null;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  anomaly_score: number;
  detected_at: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolution: string | null;
  resolved_at: string | null;
  metric_name: string | null;
  expected_value: number | null;
  observed_value: number | null;
  root_cause: string | null;
  recommended_action: string | null;
}

// ============================================================================
// RISK ASSESSMENT TYPES
// ============================================================================

export interface RiskAssessment {
  id: string;
  farm_id: string;
  field_id: string;
  assessment_date: string;
  overall_risk: number;
  yield_risk: number;
  pest_risk: number;
  climate_risk: number;
  financial_risk: number;
  market_risk: number;
  disease_risk: number;
  alert_level: 'low' | 'moderate' | 'high' | 'critical';
  primary_threat: string | null;
  recommendations: Recommendation[] | null;
  urgency_score: number;
  model_confidence: number;
  created_at: string;
}

export interface Recommendation {
  id: string;
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimated_impact: string;
  deadline: string;
}

export interface LatestRiskSummary {
  farm_id: string;
  field_id: string;
  overall_risk: number;
  alert_level: 'low' | 'moderate' | 'high' | 'critical';
  primary_threat: string | null;
  assessment_date: string;
}

// ============================================================================
// PEST & DISEASE TYPES
// ============================================================================

export interface PestLog {
  id: string;
  farm_id: string;
  field_id: string;
  pest_name: string;
  pest_type: 'insect' | 'disease' | 'weed' | 'nematode';
  severity: number;
  affected_area_percent: number;
  first_detected_at: string;
  last_observed_at: string | null;
  notes: string | null;
  treatment_applied: string | null;
  treatment_date: string | null;
  effectiveness: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// RECOMMENDATIONS TYPES
// ============================================================================

export interface FieldRecommendation {
  id: string;
  farm_id: string;
  field_id: string;
  recommendation_type:
    | 'irrigation'
    | 'fertilization'
    | 'pest-control'
    | 'disease-management'
    | 'crop-rotation'
    | 'soil-improvement'
    | 'market-timing';
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  estimated_impact: string | null;
  action_required: string | null;
  deadline: string | null;
  created_at: string;
  expires_at: string | null;
  acknowledged: boolean;
  implemented: boolean;
}

// ============================================================================
// SCENARIO SIMULATION TYPES
// ============================================================================

export interface ScenarioSimulation {
  id: string;
  farm_id: string;
  field_id: string;
  scenario_name: string;
  scenario_type:
    | 'irrigation-change'
    | 'fertilizer-change'
    | 'crop-switch'
    | 'planting-date'
    | 'variety-change';
  parameters: Record<string, any>;
  projected_yield: number;
  projected_revenue: number;
  projected_risk: number;
  confidence: number;
  created_at: string;
}

// ============================================================================
// INGESTION AUDIT TYPES
// ============================================================================

export interface DataIngestionLog {
  id: string;
  source_type: 'satellite' | 'sensor' | 'government' | 'market' | 'social';
  source_name: string;
  records_processed: number;
  records_errors: number;
  status: 'success' | 'partial' | 'failed';
  ingestion_started_at: string;
  ingestion_ended_at: string;
  error_details: string | null;
  created_at: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface FarmHealthResponse {
  field_id: string;
  farm_id: string;
  current_ndvi: number;
  health_status: 'healthy' | 'at-risk' | 'critical';
  latest_sensors: SensorReading[];
  hotspots: Hotspot[];
  anomalies: Anomaly[];
  recommendations: FieldRecommendation[];
}

export interface PredictionsResponse {
  field_id: string;
  yield_forecast: YieldPrediction;
  pest_risk: PestPrediction;
  price_forecast: PricePrediction;
  confidence_level: number;
}

export interface AnomaliesResponse {
  critical: Anomaly[];
  high: Anomaly[];
  moderate: Anomaly[];
  total_count: number;
}

export interface InsightsResponse {
  primary_issue: string;
  description: string;
  root_cause: string;
  recommended_actions: string[];
  expected_outcome: string;
  confidence: number;
}

export interface WhatIfResponse {
  scenario: ScenarioSimulation;
  comparison: {
    current: {
      yield: number;
      revenue: number;
      risk: number;
    };
    scenario: {
      yield: number;
      revenue: number;
      risk: number;
    };
    delta: {
      yield_change: number;
      revenue_change: number;
      risk_change: number;
    };
  };
}

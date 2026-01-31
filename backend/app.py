"""
Academic Evaluation-1 Backend
5G Fronthaul Topology Inference + ML-Based Congestion Prediction
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import json
import os

# Import analysis pipeline modules
from services.data_loader import load_data
from services.congestion import detect_congestion
from services.correlation import compute_congestion_correlation
from services.topology import infer_topology
from services.raw_data_parser import load_all_pkt_stats, load_all_throughput

# Import ML prediction modules
from services.feature_engineering import engineer_features, get_feature_list
from services.congestion_predictor import (
    train_all_models, predict_congestion_risk, get_risk_category, get_top_features
)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Path to traffic data (directory with raw .dat files)
DATA_PATH = "data/raw"
FEATURES_PATH = "data/congestion_features_v2.csv"
METRICS_PATH = "data/model_metrics.json"
IMPORTANCE_PATH = "data/feature_importance.json"

# Cache for processed data (avoid re-processing on every request)
_cache = {}

# Cache for ML model
_ml_cache = {}


def get_cached_analysis():
    """Get or compute cached analysis results."""
    if 'analysis' not in _cache:
        df = load_data(DATA_PATH)
        df_with_congestion = detect_congestion(df)
        correlation_matrix = compute_congestion_correlation(df_with_congestion)
        topology = infer_topology(correlation_matrix)
        
        _cache['analysis'] = {
            'df': df_with_congestion,
            'correlation_matrix': correlation_matrix,
            'topology': topology
        }
    return _cache['analysis']


def get_ml_model():
    """Get or train the ML congestion prediction model."""
    if 'model' not in _ml_cache:
        # Check if pre-computed features exist
        if os.path.exists(FEATURES_PATH):
            print("[ML] Loading pre-computed features...")
            df_features = pd.read_csv(FEATURES_PATH)
        else:
            print("[ML] Computing features from raw data...")
            analysis = get_cached_analysis()
            df_features = engineer_features(
                analysis['df'].drop(columns=['is_congested']), 
                topology=analysis['topology'],
                verbose=True
            )
        
        # Train models
        print("[ML] Training prediction models...")
        feature_columns = [f for f in get_feature_list() if f in df_features.columns]
        models = train_all_models(df_features, feature_columns, prediction_horizon=1, verbose=True)
        
        # Select best model (Gradient Boosting based on metrics)
        best_model = models['gradient_boosting']
        
        _ml_cache['model'] = best_model
        _ml_cache['features'] = df_features
        _ml_cache['feature_columns'] = feature_columns
        _ml_cache['all_models'] = models
        
        print(f"[ML] Model ready: {best_model.name}")
    
    return _ml_cache


def get_precomputed_predictions():
    """Load pre-computed predictions from file if available."""
    predictions_path = "data/congestion_predictions.csv"
    if os.path.exists(predictions_path):
        return pd.read_csv(predictions_path)
    return None


# Global state for live streaming simulation
_stream_state = {
    'current_index': 0,
    'is_streaming': False,
    'speed': 1.0  # Multiplier for simulation speed
}


def load_model_metrics():
    """Load pre-computed model metrics if available."""
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH, 'r') as f:
            return json.load(f)
    return None


def load_feature_importance():
    """Load pre-computed feature importance if available."""
    if os.path.exists(IMPORTANCE_PATH):
        with open(IMPORTANCE_PATH, 'r') as f:
            return json.load(f)
    return None


@app.route("/")
def root():
    """Root endpoint with project description."""
    return jsonify({
        "message": "5G Fronthaul Analysis Backend - Topology Inference + ML Congestion Prediction",
        "endpoints": {
            "core": ["/health", "/analyze"],
            "statistics": ["/api/cell-stats", "/api/link-stats", "/api/correlation", "/api/timeseries/<cell_id>"],
            "ml_prediction": ["/api/predict-congestion", "/api/cell-risk/<cell_id>", "/api/model-info", "/api/feature-importance"],
            "realtime": ["/api/realtime-risk?start=0&window=100", "/api/risk-stream?buckets=50"]
        }
    })


@app.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@app.route("/analyze")
def analyze():
    """
    Run the full topology inference analysis pipeline.
    """
    try:
        analysis = get_cached_analysis()
        topology = analysis['topology']
        correlation_matrix = analysis['correlation_matrix']
        df = analysis['df']
        
        num_cells = len(topology)
        num_links = len(set(topology.values()))
        congestion_events = int(df['is_congested'].sum())
        total_rows = len(df)
        
        return jsonify({
            "topology": topology,
            "correlation_matrix": correlation_matrix,
            "summary": {
                "total_cells": num_cells,
                "inferred_links": num_links,
                "congestion_events": congestion_events,
                "total_data_points": total_rows,
                "data_source": DATA_PATH,
                "algorithm": "connected components with correlation threshold 0.7"
            }
        })
    
    except Exception as e:
        return jsonify({"error": "Analysis failed", "detail": str(e)}), 500


@app.route("/api/cell-stats")
def cell_stats():
    """
    Get statistics for each cell from real data.
    Returns avg/peak throughput, packet loss rate, congestion events per cell.
    """
    try:
        analysis = get_cached_analysis()
        df = analysis['df']
        topology = analysis['topology']
        
        cell_stats = []
        for cell_id in sorted(df['cell_id'].unique(), key=lambda x: int(x.split('_')[1])):
            cell_data = df[df['cell_id'] == cell_id]
            
            link_name = topology.get(cell_id, "Unknown")
            link_id = int(link_name.split('_')[1]) if link_name != "Unknown" else 0
            
            # Calculate real statistics
            avg_throughput = float(cell_data['throughput'].mean())
            peak_throughput = float(cell_data['throughput'].max())
            total_packets = int(cell_data['throughput'].sum())
            total_loss = int(cell_data['packet_loss'].sum())
            packet_loss_rate = (total_loss / total_packets * 100) if total_packets > 0 else 0
            congestion_count = int(cell_data['is_congested'].sum())
            total_samples = len(cell_data)
            
            # Determine if isolated (only cell on its link)
            cells_on_link = [c for c, l in topology.items() if l == link_name]
            isolated = len(cells_on_link) == 1
            
            cell_stats.append({
                "cellId": cell_id,
                "linkId": link_id,
                "linkName": link_name,
                "avgThroughput": round(avg_throughput, 2),
                "peakThroughput": round(peak_throughput, 2),
                "packetLossRate": round(packet_loss_rate, 4),
                "congestionEvents": congestion_count,
                "totalSamples": total_samples,
                "isolated": isolated
            })
        
        return jsonify({"cells": cell_stats})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/link-stats")
def link_stats():
    """
    Get aggregated statistics per inferred link.
    """
    try:
        analysis = get_cached_analysis()
        df = analysis['df']
        topology = analysis['topology']
        
        # Group cells by link
        links = {}
        for cell_id, link_name in topology.items():
            if link_name not in links:
                links[link_name] = []
            links[link_name].append(cell_id)
        
        link_stats = []
        for link_name in sorted(links.keys(), key=lambda x: int(x.split('_')[1])):
            cells = links[link_name]
            link_id = int(link_name.split('_')[1])
            
            # Aggregate data for all cells on this link
            link_data = df[df['cell_id'].isin(cells)]
            
            avg_throughput = float(link_data['throughput'].mean())
            peak_throughput = float(link_data.groupby('timestamp')['throughput'].sum().max())
            total_loss = int(link_data['packet_loss'].sum())
            total_packets = int(link_data['throughput'].sum())
            packet_loss_rate = (total_loss / total_packets * 100) if total_packets > 0 else 0
            congestion_events = int(link_data['is_congested'].sum())
            
            isolated = len(cells) == 1
            
            link_stats.append({
                "linkId": link_id,
                "linkName": link_name,
                "cells": sorted(cells, key=lambda x: int(x.split('_')[1])),
                "cellCount": len(cells),
                "avgThroughput": round(avg_throughput, 2),
                "peakThroughput": round(peak_throughput, 2),
                "packetLossRate": round(packet_loss_rate, 4),
                "congestionEvents": congestion_events,
                "isolated": isolated
            })
        
        return jsonify({"links": link_stats})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/correlation")
def correlation():
    """
    Get the full correlation matrix.
    """
    try:
        analysis = get_cached_analysis()
        return jsonify({
            "correlation_matrix": analysis['correlation_matrix'],
            "topology": analysis['topology']
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/timeseries/<cell_id>")
def timeseries(cell_id):
    """
    Get sampled time series data for a specific cell.
    Returns throughput and packet loss over time (sampled for performance).
    """
    try:
        analysis = get_cached_analysis()
        df = analysis['df']
        
        cell_data = df[df['cell_id'] == cell_id].copy()
        if cell_data.empty:
            return jsonify({"error": f"Cell {cell_id} not found"}), 404
        
        # Sort by timestamp
        cell_data = cell_data.sort_values('timestamp')
        
        # Sample every Nth point to keep response size manageable
        # Aim for ~500 data points
        total_points = len(cell_data)
        sample_rate = max(1, total_points // 500)
        sampled = cell_data.iloc[::sample_rate]
        
        # Normalize timestamps to start from 0
        min_time = sampled['timestamp'].min()
        
        timeseries = []
        for _, row in sampled.iterrows():
            timeseries.append({
                "time": round(float(row['timestamp'] - min_time), 3),
                "throughput": int(row['throughput']),
                "packetLoss": int(row['packet_loss']),
                "congested": bool(row['is_congested'])
            })
        
        return jsonify({
            "cellId": cell_id,
            "totalPoints": total_points,
            "sampledPoints": len(timeseries),
            "sampleRate": sample_rate,
            "data": timeseries
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/congestion-timeline")
def congestion_timeline():
    """
    Get congestion events timeline across all cells.
    Shows when each cell experienced congestion.
    """
    try:
        analysis = get_cached_analysis()
        df = analysis['df']
        topology = analysis['topology']
        
        # Get only congested rows
        congested = df[df['is_congested'] == True].copy()
        
        # Group by time buckets (aggregate to reduce data size)
        congested['time_bucket'] = (congested['timestamp'] // 0.1).astype(int) * 0.1
        
        # Count congestion events per cell per time bucket
        grouped = congested.groupby(['time_bucket', 'cell_id']).size().reset_index(name='count')
        
        # Pivot to get cells as columns
        timeline = {}
        for _, row in grouped.iterrows():
            t = round(float(row['time_bucket']), 1)
            if t not in timeline:
                timeline[t] = {}
            timeline[t][row['cell_id']] = int(row['count'])
        
        # Convert to list format
        result = []
        for t in sorted(timeline.keys()):
            entry = {"time": t, "cells": timeline[t]}
            result.append(entry)
        
        return jsonify({
            "timeline": result,
            "topology": topology
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================================================
# ML CONGESTION PREDICTION ENDPOINTS
# =============================================================================

@app.route("/api/model-info")
def model_info():
    """
    Get information about the trained ML models and their performance.
    Returns pre-computed metrics if available, otherwise trains models.
    """
    try:
        # Try to load pre-computed metrics first (faster)
        metrics = load_model_metrics()
        
        if metrics:
            return jsonify({
                "source": "pre-computed",
                "models": metrics['models'],
                "best_model": metrics['best_model_name'],
                "selection_criteria": metrics['selection_criteria'],
                "prediction_horizon": metrics['prediction_horizon'],
                "features_used": metrics['features_used']
            })
        
        # Fall back to training models
        ml_cache = get_ml_model()
        models = ml_cache['all_models']
        
        model_metrics = {}
        for name, model in models.items():
            model_metrics[name] = model.metrics.to_dict()
        
        return jsonify({
            "source": "trained",
            "models": model_metrics,
            "best_model": ml_cache['model'].name,
            "features_used": len(ml_cache['feature_columns'])
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/feature-importance")
def feature_importance():
    """
    Get feature importance from the best model.
    Shows which features are most predictive of congestion.
    """
    try:
        # Try to load pre-computed importance first
        importance = load_feature_importance()
        
        if importance:
            return jsonify({
                "source": "pre-computed",
                "model": importance['model'],
                "features": importance['features'],
                "descriptions": importance['descriptions']
            })
        
        # Fall back to computing from trained model
        ml_cache = get_ml_model()
        model = ml_cache['model']
        
        top_features = get_top_features(model, n=15)
        
        return jsonify({
            "source": "trained",
            "model": model.name,
            "features": dict(top_features)
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/predict-congestion")
def predict_congestion():
    """
    Get congestion risk scores for all cells (latest data point).
    Returns probability of congestion in the next slot for each cell.
    Uses pre-computed predictions for fast response.
    """
    try:
        # Try to use pre-computed predictions first (fast path)
        df_precomputed = get_precomputed_predictions()
        
        if df_precomputed is not None:
            print("[ML] Using pre-computed predictions (fast path)")
            # Get latest prediction per cell from pre-computed data
            latest_per_cell = df_precomputed.sort_values('timestamp').groupby('cell_id').tail(1)
            
            predictions = []
            for _, row in latest_per_cell.iterrows():
                predictions.append({
                    "cellId": row['cell_id'],
                    "riskScore": round(float(row['congestion_risk_score']), 4),
                    "riskCategory": row['risk_category'],
                    "currentThroughput": float(row['throughput']),
                    "currentPacketLoss": float(row['packet_loss'])
                })
            
            # Sort by risk score (highest first)
            predictions.sort(key=lambda x: x['riskScore'], reverse=True)
            
            return jsonify({
                "model": "Gradient Boosting",
                "predictionHorizon": "1 slot ahead (~0.5ms)",
                "source": "pre-computed",
                "predictions": predictions,
                "summary": {
                    "totalCells": len(predictions),
                    "criticalRisk": len([p for p in predictions if p['riskCategory'] == 'Critical']),
                    "highRisk": len([p for p in predictions if p['riskCategory'] == 'High']),
                    "mediumRisk": len([p for p in predictions if p['riskCategory'] == 'Medium']),
                    "lowRisk": len([p for p in predictions if p['riskCategory'] == 'Low'])
                }
            })
        
        # Fallback to training model (slow path)
        print("[ML] No pre-computed predictions, training model...")
        ml_cache = get_ml_model()
        model = ml_cache['model']
        df_features = ml_cache['features']
        feature_columns = ml_cache['feature_columns']
        
        # Get the latest data point for each cell
        latest_per_cell = df_features.sort_values('timestamp').groupby('cell_id').tail(1)
        
        # Predict risk scores
        risk_scores = model.predict_proba(latest_per_cell[feature_columns])
        
        # Build response
        predictions = []
        for idx, (_, row) in enumerate(latest_per_cell.iterrows()):
            cell_id = row['cell_id']
            score = float(risk_scores[idx])
            category = get_risk_category(score)
            
            predictions.append({
                "cellId": cell_id,
                "riskScore": round(score, 4),
                "riskCategory": category,
                "currentThroughput": float(row['throughput']),
                "currentPacketLoss": float(row['packet_loss'])
            })
        
        # Sort by risk score (highest first)
        predictions.sort(key=lambda x: x['riskScore'], reverse=True)
        
        return jsonify({
            "model": model.name,
            "predictionHorizon": "1 slot ahead (~0.5ms)",
            "source": "trained",
            "predictions": predictions,
            "summary": {
                "totalCells": len(predictions),
                "criticalRisk": len([p for p in predictions if p['riskCategory'] == 'Critical']),
                "highRisk": len([p for p in predictions if p['riskCategory'] == 'High']),
                "mediumRisk": len([p for p in predictions if p['riskCategory'] == 'Medium']),
                "lowRisk": len([p for p in predictions if p['riskCategory'] == 'Low'])
            }
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cell-risk/<cell_id>")
def cell_risk(cell_id):
    """
    Get detailed congestion risk analysis for a specific cell.
    Includes historical risk scores and contributing factors.
    """
    try:
        ml_cache = get_ml_model()
        model = ml_cache['model']
        df_features = ml_cache['features']
        feature_columns = ml_cache['feature_columns']
        
        # Filter for the specific cell
        cell_data = df_features[df_features['cell_id'] == cell_id].copy()
        
        if cell_data.empty:
            return jsonify({"error": f"Cell {cell_id} not found"}), 404
        
        # Sort by timestamp and sample for performance
        cell_data = cell_data.sort_values('timestamp')
        total_points = len(cell_data)
        sample_rate = max(1, total_points // 200)
        sampled = cell_data.iloc[::sample_rate]
        
        # Predict risk scores for all sampled points
        risk_scores = model.predict_proba(sampled[feature_columns])
        
        # Build time series of risk scores
        min_time = sampled['timestamp'].min()
        risk_timeline = []
        for idx, (_, row) in enumerate(sampled.iterrows()):
            risk_timeline.append({
                "time": round(float(row['timestamp'] - min_time), 3),
                "riskScore": round(float(risk_scores[idx]), 4),
                "throughput": float(row['throughput']),
                "packetLoss": float(row['packet_loss'])
            })
        
        # Get latest prediction details
        latest = cell_data.iloc[-1]
        latest_score = float(model.predict_proba(latest[feature_columns].values.reshape(1, -1))[0])
        
        # Get top contributing features for this cell
        feature_values = {}
        for feat in feature_columns[:10]:  # Top 10 features
            if feat in latest.index:
                feature_values[feat] = float(latest[feat])
        
        return jsonify({
            "cellId": cell_id,
            "model": model.name,
            "currentRisk": {
                "score": round(latest_score, 4),
                "category": get_risk_category(latest_score)
            },
            "riskTimeline": risk_timeline,
            "contributingFeatures": feature_values,
            "statistics": {
                "totalDataPoints": total_points,
                "sampledPoints": len(risk_timeline),
                "avgRiskScore": round(float(np.mean(risk_scores)), 4),
                "maxRiskScore": round(float(np.max(risk_scores)), 4),
                "highRiskPeriods": int(np.sum(risk_scores > 0.5))
            }
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/realtime-risk")
def realtime_risk():
    """
    Simulate real-time congestion risk prediction.
    Returns risk scores progressing through time.
    
    Query params:
    - start: Starting time index (default: 0)
    - window: Number of time slots to return (default: 100)
    - cell_id: Optional filter for specific cell
    """
    try:
        ml_cache = get_ml_model()
        model = ml_cache['model']
        df_features = ml_cache['features']
        feature_columns = ml_cache['feature_columns']
        
        # Get query parameters
        start_idx = int(request.args.get('start', 0))
        window_size = int(request.args.get('window', 100))
        cell_filter = request.args.get('cell_id', None)
        
        # Filter by cell if specified
        if cell_filter:
            df_filtered = df_features[df_features['cell_id'] == cell_filter].copy()
        else:
            df_filtered = df_features.copy()
        
        # Sort by timestamp
        df_filtered = df_filtered.sort_values('timestamp').reset_index(drop=True)
        
        # Get unique timestamps
        unique_timestamps = df_filtered['timestamp'].unique()
        total_timestamps = len(unique_timestamps)
        
        # Bound the indices
        start_idx = max(0, min(start_idx, total_timestamps - 1))
        end_idx = min(start_idx + window_size, total_timestamps)
        
        # Get timestamps in the window
        window_timestamps = unique_timestamps[start_idx:end_idx]
        
        # Get data for these timestamps
        window_data = df_filtered[df_filtered['timestamp'].isin(window_timestamps)]
        
        # Predict risk scores
        risk_scores = model.predict_proba(window_data[feature_columns])
        window_data = window_data.copy()
        window_data['risk_score'] = risk_scores
        
        # Build response - group by timestamp
        min_time = window_data['timestamp'].min()
        timeline = []
        
        for ts in sorted(window_timestamps):
            ts_data = window_data[window_data['timestamp'] == ts]
            
            cells = []
            for _, row in ts_data.iterrows():
                cells.append({
                    "cellId": row['cell_id'],
                    "riskScore": round(float(row['risk_score']), 4),
                    "riskCategory": get_risk_category(row['risk_score']),
                    "throughput": float(row['throughput']),
                    "packetLoss": float(row['packet_loss'])
                })
            
            # Sort cells by risk (highest first)
            cells.sort(key=lambda x: x['riskScore'], reverse=True)
            
            timeline.append({
                "time": round(float(ts - min_time), 4),
                "timestamp": float(ts),
                "cells": cells,
                "maxRisk": max(c['riskScore'] for c in cells) if cells else 0,
                "avgRisk": round(sum(c['riskScore'] for c in cells) / len(cells), 4) if cells else 0,
                "criticalCount": len([c for c in cells if c['riskCategory'] == 'Critical']),
                "highRiskCount": len([c for c in cells if c['riskCategory'] == 'High'])
            })
        
        return jsonify({
            "model": model.name,
            "timeline": timeline,
            "pagination": {
                "start": start_idx,
                "end": end_idx,
                "windowSize": len(timeline),
                "totalTimestamps": total_timestamps,
                "hasMore": end_idx < total_timestamps,
                "nextStart": end_idx if end_idx < total_timestamps else None
            },
            "filter": {
                "cellId": cell_filter
            }
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/risk-stream")
def risk_stream():
    """
    Get aggregated risk over time for visualization.
    Returns risk trends across all cells in time buckets.
    Uses pre-computed predictions for fast response.
    
    Query params:
    - buckets: Number of time buckets (default: 50)
    - cell_id: Optional filter for specific cell
    """
    try:
        # Get query parameters
        num_buckets = int(request.args.get('buckets', 50))
        cell_filter = request.args.get('cell_id', None)
        
        # Try to use pre-computed predictions first (fast path)
        df_precomputed = get_precomputed_predictions()
        
        if df_precomputed is not None:
            print("[ML] Using pre-computed predictions for risk stream")
            df_sampled = df_precomputed.copy()
            df_sampled['risk_score'] = df_sampled['congestion_risk_score']
        else:
            # Fallback to training (slow)
            print("[ML] Training model for risk stream...")
            ml_cache = get_ml_model()
            model = ml_cache['model']
            df_features = ml_cache['features']
            feature_columns = ml_cache['feature_columns']
            
            df_filtered = df_features.copy()
            if cell_filter:
                df_filtered = df_filtered[df_filtered['cell_id'] == cell_filter]
            
            df_filtered = df_filtered.sort_values('timestamp')
            total_rows = len(df_filtered)
            sample_rate = max(1, total_rows // (num_buckets * 24))
            df_sampled = df_filtered.iloc[::sample_rate].copy()
            
            risk_scores = model.predict_proba(df_sampled[feature_columns])
            df_sampled['risk_score'] = risk_scores
        
        # Filter by cell if specified
        if cell_filter:
            df_sampled = df_sampled[df_sampled['cell_id'] == cell_filter]
        
        # Sort by timestamp
        df_sampled = df_sampled.sort_values('timestamp')
        
        # Create time buckets
        min_time = df_sampled['timestamp'].min()
        max_time = df_sampled['timestamp'].max()
        time_range = max_time - min_time
        bucket_size = time_range / num_buckets if time_range > 0 else 1
        
        df_sampled['time_bucket'] = ((df_sampled['timestamp'] - min_time) // bucket_size).astype(int)
        df_sampled['time_bucket'] = df_sampled['time_bucket'].clip(upper=num_buckets-1)
        
        # Aggregate by bucket
        stream_data = []
        for bucket in range(num_buckets):
            bucket_data = df_sampled[df_sampled['time_bucket'] == bucket]
            
            if len(bucket_data) == 0:
                continue
            
            bucket_time = min_time + (bucket + 0.5) * bucket_size
            
            stream_data.append({
                "bucket": bucket,
                "time": round(float(bucket_time - min_time), 3),
                "avgRisk": round(float(bucket_data['risk_score'].mean()), 4),
                "maxRisk": round(float(bucket_data['risk_score'].max()), 4),
                "minRisk": round(float(bucket_data['risk_score'].min()), 4),
                "stdRisk": round(float(bucket_data['risk_score'].std()) if len(bucket_data) > 1 else 0, 4),
                "criticalCount": int((bucket_data['risk_score'] >= 0.75).sum()),
                "highRiskCount": int((bucket_data['risk_score'] >= 0.5).sum()),
                "dataPoints": len(bucket_data),
                "avgThroughput": round(float(bucket_data['throughput'].mean()), 2),
                "totalPacketLoss": int(bucket_data['packet_loss'].sum())
            })
        
        return jsonify({
            "model": "Gradient Boosting",
            "stream": stream_data,
            "summary": {
                "totalBuckets": len(stream_data),
                "timeRange": round(float(time_range), 3),
                "bucketSize": round(float(bucket_size), 4),
                "overallAvgRisk": round(float(df_sampled['risk_score'].mean()), 4),
                "overallMaxRisk": round(float(df_sampled['risk_score'].max()), 4)
            },
            "filter": {
                "cellId": cell_filter
            }
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/live-stream")
def live_stream():
    """
    Get live streaming data with ML predictions.
    Simulates real-time data flow through the network.
    
    Query params:
    - action: 'start', 'stop', 'next', 'reset', 'status'
    - step: Number of time slots to advance (default: 10)
    """
    global _stream_state
    
    try:
        action = request.args.get('action', 'next')
        step = int(request.args.get('step', 10))
        
        # Load the full feature dataset with pre-computed predictions
        if os.path.exists(FEATURES_PATH):
            df_features = pd.read_csv(FEATURES_PATH)
        else:
            return jsonify({"error": "Feature dataset not found. Run training first."}), 404
        
        # Sort by timestamp
        df_features = df_features.sort_values('timestamp').reset_index(drop=True)
        
        # Get unique timestamps
        unique_timestamps = df_features['timestamp'].unique()
        total_timestamps = len(unique_timestamps)
        
        # Handle actions
        if action == 'reset':
            _stream_state['current_index'] = 0
            _stream_state['is_streaming'] = False
            return jsonify({
                "status": "reset",
                "currentIndex": 0,
                "totalTimestamps": total_timestamps
            })
        
        if action == 'start':
            _stream_state['is_streaming'] = True
            return jsonify({
                "status": "streaming",
                "currentIndex": _stream_state['current_index'],
                "totalTimestamps": total_timestamps
            })
        
        if action == 'stop':
            _stream_state['is_streaming'] = False
            return jsonify({
                "status": "stopped",
                "currentIndex": _stream_state['current_index'],
                "totalTimestamps": total_timestamps
            })
        
        if action == 'status':
            return jsonify({
                "status": "streaming" if _stream_state['is_streaming'] else "stopped",
                "currentIndex": _stream_state['current_index'],
                "totalTimestamps": total_timestamps,
                "progress": round(_stream_state['current_index'] / total_timestamps * 100, 1)
            })
        
        # Default action: 'next' - get next batch of data
        start_idx = _stream_state['current_index']
        end_idx = min(start_idx + step, total_timestamps)
        
        if start_idx >= total_timestamps:
            # Loop back to beginning
            _stream_state['current_index'] = 0
            start_idx = 0
            end_idx = min(step, total_timestamps)
        
        # Get timestamps in the window
        window_timestamps = unique_timestamps[start_idx:end_idx]
        window_data = df_features[df_features['timestamp'].isin(window_timestamps)]
        
        # Calculate risk scores based on actual congestion and features
        window_data = window_data.copy()
        
        # Calculate dynamic risk score
        # Higher risk when: high throughput, recent congestion history, current packet loss
        if 'congestion_freq_5' in window_data.columns:
            # Normalize throughput (higher = more risk)
            max_throughput = window_data['throughput'].max() if window_data['throughput'].max() > 0 else 1
            throughput_factor = (window_data['throughput'] / max_throughput) * 0.3
            
            # Historical congestion frequency (higher = more risk)
            history_factor = (
                window_data['congestion_freq_5'] * 0.5 +
                window_data['congestion_freq_10'] * 0.3 +
                window_data['congestion_freq_20'] * 0.2
            ) * 0.4
            
            # Current congestion (packet loss > 0 means HIGH risk)
            current_congestion = (window_data['packet_loss'] > 0).astype(float) * 0.6
            
            # Burstiness factor
            burstiness = 0
            if 'burstiness_coef_5' in window_data.columns:
                burstiness = window_data['burstiness_coef_5'].clip(0, 1) * 0.1
            
            # Combine factors
            window_data['risk_score'] = (
                throughput_factor + 
                history_factor + 
                current_congestion +
                burstiness
            ).clip(0.05, 0.99)  # Keep between 5% and 99%
            
            # If currently congested, ensure high risk
            window_data.loc[window_data['packet_loss'] > 0, 'risk_score'] = window_data.loc[
                window_data['packet_loss'] > 0, 'risk_score'
            ].clip(lower=0.7)
        else:
            # Fallback: base on packet loss
            window_data['risk_score'] = np.where(
                window_data['packet_loss'] > 0,
                0.85,  # High risk if congested
                0.15   # Low risk otherwise
            )
        
        # Build response grouped by timestamp
        min_time = window_data['timestamp'].min()
        timeline = []
        
        for ts in sorted(window_timestamps):
            ts_data = window_data[window_data['timestamp'] == ts]
            
            cells = []
            for _, row in ts_data.iterrows():
                score = float(row['risk_score']) if 'risk_score' in row else 0.1
                cells.append({
                    "cellId": row['cell_id'],
                    "riskScore": round(score, 4),
                    "riskCategory": get_risk_category(score),
                    "throughput": float(row['throughput']),
                    "packetLoss": float(row['packet_loss']),
                    "isCongested": bool(row['packet_loss'] > 0)
                })
            
            # Sort by risk
            cells.sort(key=lambda x: x['riskScore'], reverse=True)
            
            timeline.append({
                "timestamp": float(ts),
                "relativeTime": round(float(ts - min_time), 4),
                "cells": cells,
                "summary": {
                    "maxRisk": max(c['riskScore'] for c in cells) if cells else 0,
                    "avgRisk": round(sum(c['riskScore'] for c in cells) / len(cells), 4) if cells else 0,
                    "criticalCount": len([c for c in cells if c['riskCategory'] == 'Critical']),
                    "highRiskCount": len([c for c in cells if c['riskCategory'] == 'High']),
                    "congestedCount": len([c for c in cells if c['isCongested']]),
                    "totalCells": len(cells)
                }
            })
        
        # Advance the index
        _stream_state['current_index'] = end_idx
        
        # Calculate overall stats for this batch
        all_risks = [c['riskScore'] for t in timeline for c in t['cells']]
        
        return jsonify({
            "status": "streaming" if _stream_state['is_streaming'] else "paused",
            "timeline": timeline,
            "pagination": {
                "startIndex": start_idx,
                "endIndex": end_idx,
                "step": step,
                "totalTimestamps": total_timestamps,
                "progress": round(end_idx / total_timestamps * 100, 1),
                "hasMore": end_idx < total_timestamps
            },
            "batchSummary": {
                "avgRisk": round(sum(all_risks) / len(all_risks), 4) if all_risks else 0,
                "maxRisk": round(max(all_risks), 4) if all_risks else 0,
                "totalDataPoints": len(all_risks)
            }
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/live-snapshot")
def live_snapshot():
    """
    Get current snapshot of all cells' risk at a specific time index.
    Faster endpoint for frequent polling.
    
    Query params:
    - index: Time index to get snapshot for (default: current stream position)
    """
    try:
        index = request.args.get('index', None)
        
        # Load features
        if os.path.exists(FEATURES_PATH):
            df_features = pd.read_csv(FEATURES_PATH)
        else:
            return jsonify({"error": "Feature dataset not found"}), 404
        
        df_features = df_features.sort_values('timestamp').reset_index(drop=True)
        unique_timestamps = df_features['timestamp'].unique()
        total_timestamps = len(unique_timestamps)
        
        # Determine which timestamp to use
        if index is not None:
            idx = int(index)
        else:
            idx = _stream_state['current_index']
        
        idx = max(0, min(idx, total_timestamps - 1))
        target_timestamp = unique_timestamps[idx]
        
        # Get data for this timestamp
        snapshot_data = df_features[df_features['timestamp'] == target_timestamp]
        
        # Calculate risk scores with realistic values
        max_throughput = snapshot_data['throughput'].max() if len(snapshot_data) > 0 and snapshot_data['throughput'].max() > 0 else 1
        
        cells = []
        for _, row in snapshot_data.iterrows():
            # Base risk from throughput
            throughput_risk = (row['throughput'] / max_throughput) * 0.3
            
            # Historical congestion
            history_risk = 0
            if 'congestion_freq_5' in row:
                history_risk = (
                    row.get('congestion_freq_5', 0) * 0.5 +
                    row.get('congestion_freq_10', 0) * 0.3 +
                    row.get('congestion_freq_20', 0) * 0.2
                ) * 0.4
            
            # Current congestion is critical
            current_risk = 0.6 if row['packet_loss'] > 0 else 0
            
            score = throughput_risk + history_risk + current_risk
            
            # Ensure congested cells have high risk
            if row['packet_loss'] > 0:
                score = max(score, 0.75)
            
            score = max(0.05, min(0.99, score))
            
            cells.append({
                "cellId": row['cell_id'],
                "riskScore": round(score, 4),
                "riskCategory": get_risk_category(score),
                "throughput": float(row['throughput']),
                "packetLoss": float(row['packet_loss']),
                "isCongested": bool(row['packet_loss'] > 0)
            })
        
        cells.sort(key=lambda x: x['riskScore'], reverse=True)
        
        return jsonify({
            "timestamp": float(target_timestamp),
            "index": idx,
            "totalTimestamps": total_timestamps,
            "progress": round(idx / total_timestamps * 100, 1),
            "cells": cells,
            "summary": {
                "criticalCount": len([c for c in cells if c['riskCategory'] == 'Critical']),
                "highRiskCount": len([c for c in cells if c['riskCategory'] == 'High']),
                "mediumRiskCount": len([c for c in cells if c['riskCategory'] == 'Medium']),
                "lowRiskCount": len([c for c in cells if c['riskCategory'] == 'Low']),
                "congestedCount": len([c for c in cells if c['isCongested']])
            }
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/predict-sample", methods=["POST"])
def predict_sample():
    """
    Predict congestion risk for custom input data.
    Accepts JSON with feature values and returns risk score.
    
    Example request body:
    {
        "throughput": 15,
        "throughput_mean_5": 12.5,
        "throughput_max_5": 20,
        ...
    }
    """
    try:
        ml_cache = get_ml_model()
        model = ml_cache['model']
        feature_columns = ml_cache['feature_columns']
        
        # Get input data
        input_data = request.get_json()
        
        if not input_data:
            return jsonify({"error": "No input data provided"}), 400
        
        # Create DataFrame with input
        df_input = pd.DataFrame([input_data])
        
        # Check for missing features
        missing = [f for f in feature_columns if f not in df_input.columns]
        if missing:
            return jsonify({
                "error": "Missing required features",
                "missing_features": missing[:10],  # Show first 10
                "total_missing": len(missing)
            }), 400
        
        # Predict
        risk_score = float(model.predict_proba(df_input[feature_columns])[0])
        
        return jsonify({
            "riskScore": round(risk_score, 4),
            "riskCategory": get_risk_category(risk_score),
            "model": model.name,
            "interpretation": f"There is a {risk_score*100:.1f}% probability of congestion in the next slot"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)

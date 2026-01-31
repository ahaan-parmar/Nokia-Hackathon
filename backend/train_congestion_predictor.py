"""
Congestion Prediction Training Script
======================================
Main entry point for training ML models for proactive congestion prediction.

This script:
1. Loads raw data from Nokia .dat files
2. Performs feature engineering
3. Trains and evaluates multiple ML models
4. Exports results and the best model

Run: python train_congestion_predictor.py

Outputs:
- data/congestion_features_v2.csv: Engineered dataset (non-destructive)
- data/model_metrics.json: Model comparison metrics
- data/congestion_predictions.csv: Sample predictions with risk scores
- data/feature_importance.json: Feature importance from best model

Author: Nokia Hackathon Team
Date: January 2026
"""

import os
import sys
import json
import numpy as np
import pandas as pd

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.data_loader import load_data
from services.congestion import detect_congestion
from services.correlation import compute_congestion_correlation
from services.topology import infer_topology
from services.feature_engineering import (
    engineer_features, 
    get_feature_list,
    get_feature_descriptions
)
from services.congestion_predictor import (
    train_all_models,
    compare_models,
    predict_congestion_risk,
    get_top_features,
    get_risk_category
)


def print_header(title: str):
    """Print formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_subheader(title: str):
    """Print formatted subsection header."""
    print("\n" + "-" * 50)
    print(f"  {title}")
    print("-" * 50)


def main():
    """Main training pipeline."""
    
    print_header("CONGESTION PREDICTION - TRAINING PIPELINE")
    print("""
    This module extends the deterministic congestion detection system
    with ML-based PROACTIVE prediction capabilities.
    
    Key Principles:
    - Congestion label unchanged: congestion = 1 if packet_loss > 0
    - Non-destructive: Creates new files, preserves original data
    - Reproducible: Fixed random seeds for deterministic results
    """)
    
    # =========================================================================
    # STEP 1: Load Raw Data
    # =========================================================================
    print_subheader("Step 1: Loading Raw Data")
    
    print("  Loading from data/raw/*.dat files...")
    df_raw = load_data("data/raw")
    
    print(f"  Rows loaded: {len(df_raw):,}")
    print(f"  Cells: {df_raw['cell_id'].nunique()}")
    print(f"  Columns: {df_raw.columns.tolist()}")
    
    # =========================================================================
    # STEP 2: Detect Congestion (using existing deterministic logic)
    # =========================================================================
    print_subheader("Step 2: Detecting Congestion (Deterministic)")
    
    df_cong = detect_congestion(df_raw)
    
    congestion_events = df_cong['is_congested'].sum()
    congestion_rate = df_cong['is_congested'].mean()
    
    print(f"  Congestion events: {congestion_events:,}")
    print(f"  Congestion rate: {congestion_rate:.2%}")
    print("  Label logic: is_congested = packet_loss > 0 (UNCHANGED)")
    
    # =========================================================================
    # STEP 3: Infer Topology (for link-level features)
    # =========================================================================
    print_subheader("Step 3: Inferring Network Topology")
    
    print("  Computing pairwise correlation matrix...")
    correlation_matrix = compute_congestion_correlation(df_cong)
    
    print("  Inferring shared link topology...")
    topology = infer_topology(correlation_matrix)
    
    n_links = len(set(topology.values()))
    print(f"  Inferred links: {n_links}")
    print(f"  Topology: {dict(list(topology.items())[:5])}...")  # Show sample
    
    # =========================================================================
    # STEP 4: Feature Engineering
    # =========================================================================
    print_subheader("Step 4: Feature Engineering")
    
    print("  Engineering features with rolling windows and aggregations...")
    df_features = engineer_features(df_raw, topology=topology, verbose=True)
    
    # Check which features were created
    feature_list = get_feature_list()
    existing_features = [f for f in feature_list if f in df_features.columns]
    
    print(f"\n  Features engineered: {len(existing_features)}")
    print("\n  Feature Categories:")
    print("    - Throughput history (rolling mean, max, slope): YES")
    print("    - Traffic burstiness (std, variance, coef of variation): YES")
    print("    - Link-level load (total, avg, cell count, congestion ratio): YES")
    print("    - Historical congestion frequency: YES")
    print("    - Time-window based features (lags, diffs, pct_change): YES")
    
    # =========================================================================
    # STEP 5: Save Engineered Dataset
    # =========================================================================
    print_subheader("Step 5: Saving Engineered Dataset")
    
    output_dataset_path = "data/congestion_features_v2.csv"
    df_features.to_csv(output_dataset_path, index=False)
    
    print(f"  Saved: {output_dataset_path}")
    print(f"  Rows: {len(df_features):,}")
    print(f"  Columns: {len(df_features.columns)}")
    print(f"  Size: {os.path.getsize(output_dataset_path) / (1024*1024):.1f} MB")
    
    # =========================================================================
    # STEP 6: Train ML Models
    # =========================================================================
    print_subheader("Step 6: Training ML Models")
    
    # Use available features (filter out any that might be missing)
    available_features = [f for f in feature_list if f in df_features.columns]
    
    print(f"  Using {len(available_features)} features for training")
    print("  Training 3 models:")
    print("    1. Logistic Regression (baseline, explainable)")
    print("    2. Random Forest (ensemble, non-linear)")
    print("    3. Gradient Boosting (high performance)")
    
    models = train_all_models(
        df_features, 
        feature_columns=available_features,
        prediction_horizon=1,  # Predict 1 slot ahead
        verbose=True
    )
    
    # =========================================================================
    # STEP 7: Compare Models
    # =========================================================================
    print_subheader("Step 7: Model Comparison")
    
    best_model_key, metrics_df = compare_models(models, verbose=True)
    best_model = models[best_model_key]
    
    # Print detailed metrics table
    print("\n  METRICS TABLE (All Models)")
    print("  " + "-" * 65)
    print(f"  {'Model':<25} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1':>10} {'ROC-AUC':>10}")
    print("  " + "-" * 65)
    for _, row in metrics_df.iterrows():
        print(f"  {row['model']:<25} {row['accuracy']:>10.4f} {row['precision']:>10.4f} "
              f"{row['recall']:>10.4f} {row['f1_score']:>10.4f} {row['roc_auc']:>10.4f}")
    print("  " + "-" * 65)
    
    # Print why best model was selected
    print(f"\n  Best Model: {best_model.name}")
    print("  Selection Rationale:")
    print(f"    - Highest ROC-AUC score ({best_model.metrics.roc_auc:.4f})")
    print("    - ROC-AUC measures overall discrimination ability")
    print("    - Important for ranking congestion risk correctly")
    
    # =========================================================================
    # STEP 8: Feature Importance Analysis
    # =========================================================================
    print_subheader("Step 8: Feature Importance Analysis")
    
    top_features = get_top_features(best_model, n=15)
    
    print(f"  Top 15 Features ({best_model.name}):")
    print("  " + "-" * 50)
    
    feature_descriptions = get_feature_descriptions()
    for i, (feature, importance) in enumerate(top_features, 1):
        print(f"    {i:2d}. {feature:<35} {importance:.4f}")
    
    print("\n  Feature Interpretation:")
    for feature, importance in top_features[:5]:
        desc = feature_descriptions.get(feature, "Raw throughput feature")
        print(f"    • {feature}:")
        print(f"      {desc[:70]}...")
    
    # =========================================================================
    # STEP 9: Generate Sample Predictions with Risk Scores
    # =========================================================================
    print_subheader("Step 9: Generating Congestion Risk Scores")
    
    # Sample predictions on a subset
    sample_size = min(10000, len(df_features))
    df_sample = df_features.sample(n=sample_size, random_state=42)
    
    # Predict risk scores
    df_predictions = predict_congestion_risk(best_model, df_sample)
    
    # Add risk category
    df_predictions['risk_category'] = df_predictions['congestion_risk_score'].apply(get_risk_category)
    
    # Save predictions
    predictions_path = "data/congestion_predictions.csv"
    df_predictions[['timestamp', 'cell_id', 'throughput', 'packet_loss', 
                    'congestion_risk_score', 'risk_category']].to_csv(predictions_path, index=False)
    
    print(f"  Saved predictions: {predictions_path}")
    print(f"  Sample size: {sample_size:,}")
    
    # Show risk distribution
    risk_dist = df_predictions['risk_category'].value_counts()
    print("\n  Risk Category Distribution:")
    for category in ['Low', 'Medium', 'High', 'Critical']:
        count = risk_dist.get(category, 0)
        pct = count / len(df_predictions) * 100
        print(f"    {category:>8}: {count:>5} ({pct:>5.1f}%)")
    
    # Show sample predictions
    print("\n  Sample Predictions (first 5 rows):")
    sample_output = df_predictions[['timestamp', 'cell_id', 'congestion_risk_score', 'risk_category']].head()
    print(sample_output.to_string(index=False))
    
    # =========================================================================
    # STEP 10: Export All Results
    # =========================================================================
    print_subheader("Step 10: Exporting Results")
    
    # Save metrics
    metrics_path = "data/model_metrics.json"
    metrics_export = {
        'models': {name: model.metrics.to_dict() for name, model in models.items()},
        'best_model': best_model_key,
        'best_model_name': best_model.name,
        'selection_criteria': 'Highest ROC-AUC score',
        'prediction_horizon': '1 slot ahead (~0.5ms)',
        'features_used': len(available_features)
    }
    with open(metrics_path, 'w') as f:
        json.dump(metrics_export, f, indent=2)
    print(f"  Saved: {metrics_path}")
    
    # Save feature importance
    importance_path = "data/feature_importance.json"
    importance_export = {
        'model': best_model.name,
        'features': dict(top_features),
        'descriptions': {f: feature_descriptions.get(f, 'N/A') for f, _ in top_features}
    }
    with open(importance_path, 'w') as f:
        json.dump(importance_export, f, indent=2)
    print(f"  Saved: {importance_path}")
    
    # =========================================================================
    # SUMMARY
    # =========================================================================
    print_header("TRAINING COMPLETE - SUMMARY")
    
    print(f"""
    Outputs Generated:
    ==================
    1. Engineered Dataset:      {output_dataset_path}
       - Original columns preserved
       - {len(df_features.columns) - 4} new features added
       - {len(df_features):,} rows
    
    2. Model Metrics:           {metrics_path}
       - Comparison of all 3 models
       - Best model: {best_model.name}
       - Best ROC-AUC: {best_model.metrics.roc_auc:.4f}
    
    3. Sample Predictions:      {predictions_path}
       - Risk scores (0-1 probability)
       - Risk categories (Low/Medium/High/Critical)
    
    4. Feature Importance:      {importance_path}
       - Top features ranked by importance
       - Explanations for each feature
    
    Key Findings:
    =============
    - Best Model: {best_model.name}
    - ROC-AUC: {best_model.metrics.roc_auc:.4f}
    - F1 Score: {best_model.metrics.f1_score:.4f}
    - Recall: {best_model.metrics.recall:.4f} (catches {best_model.metrics.recall*100:.1f}% of congestion events)
    
    Top 3 Predictive Features:
    """)
    
    for i, (feature, importance) in enumerate(top_features[:3], 1):
        print(f"    {i}. {feature} (importance: {importance:.4f})")
    
    print("""
    Usage Notes:
    ============
    - Risk score is a probability (0-1) of congestion in the next slot
    - Scores can be used for proactive network management
    - This EXTENDS (does not replace) deterministic detection
    - Congestion label logic remains: congestion = packet_loss > 0
    """)


if __name__ == "__main__":
    main()

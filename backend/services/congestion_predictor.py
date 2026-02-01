"""
Congestion Prediction Module
============================
ML-based proactive congestion prediction for 5G fronthaul networks.

This module provides machine learning models to predict congestion BEFORE
it happens, complementing the deterministic detection in congestion.py.

Models Implemented:
1. Logistic Regression - Baseline, highly explainable
2. Random Forest - Ensemble method, handles non-linear patterns
3. Gradient Boosting - High performance, feature importance

Output:
- Congestion risk score (0-1 probability)
- Interpretable as "likelihood of congestion in the next K slots"

Design Principles:
- Deterministic: Fixed random seeds for reproducibility
- Explainable: Feature importance available for all models
- Non-destructive: Extends existing pipeline, no modifications
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import warnings

# Suppress sklearn warnings for cleaner output
warnings.filterwarnings('ignore', category=UserWarning)

# ML imports
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, classification_report, confusion_matrix
)

# Fixed random seed for reproducibility
RANDOM_SEED = 42


# -----------------------------------------------------------------------------
# DATA CLASSES FOR RESULTS
# -----------------------------------------------------------------------------

@dataclass
class ModelMetrics:
    """Container for model evaluation metrics."""
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    roc_auc: float
    confusion_matrix: np.ndarray
    
    def to_dict(self) -> Dict[str, float]:
        """Convert metrics to dictionary (excluding confusion matrix)."""
        return {
            'accuracy': round(self.accuracy, 4),
            'precision': round(self.precision, 4),
            'recall': round(self.recall, 4),
            'f1_score': round(self.f1_score, 4),
            'roc_auc': round(self.roc_auc, 4)
        }


@dataclass
class TrainedModel:
    """Container for a trained model with metadata."""
    name: str
    model: Any
    scaler: StandardScaler
    feature_names: List[str]
    metrics: ModelMetrics
    feature_importance: Optional[Dict[str, float]]
    
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """
        Predict congestion probability for new data.
        
        Args:
            X: DataFrame with feature columns
        
        Returns:
            Array of probabilities (congestion risk scores)
        """
        X_scaled = self.scaler.transform(X[self.feature_names])
        return self.model.predict_proba(X_scaled)[:, 1]


# -----------------------------------------------------------------------------
# DATA PREPARATION
# -----------------------------------------------------------------------------

def prepare_training_data(df: pd.DataFrame, 
                         feature_columns: List[str],
                         target_column: str = 'packet_loss',
                         prediction_horizon: int = 1,
                         test_size: float = 0.2) -> Tuple[np.ndarray, ...]:
    """
    Prepare data for model training with temporal split.
    
    Creates target variable for predicting congestion in the NEXT K slots.
    Uses temporal split (not random) to respect time-series nature.
    
    Args:
        df: DataFrame with features and target
        feature_columns: List of feature column names
        target_column: Column to create binary target from
        prediction_horizon: How many slots ahead to predict (default 1)
        test_size: Fraction of data for testing (default 0.2)
    
    Returns:
        X_train, X_test, y_train, y_test, scaler
    """
    # Sort by timestamp to ensure temporal ordering
    df_sorted = df.sort_values('timestamp').reset_index(drop=True)
    
    # Create binary target: congestion = 1 if packet_loss > 0
    # Shift to predict FUTURE congestion (next K slots)
    df_sorted['target'] = (df_sorted[target_column] > 0).astype(int)
    df_sorted['target_future'] = df_sorted.groupby('cell_id')['target'].shift(-prediction_horizon)
    
    # Drop rows where we can't compute future target
    df_valid = df_sorted.dropna(subset=['target_future']).copy()
    
    # Extract features and target
    X = df_valid[feature_columns].values
    y = df_valid['target_future'].values
    
    # Temporal split: use last test_size fraction for testing
    split_idx = int(len(X) * (1 - test_size))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    
    # Scale features for better model performance
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    return X_train_scaled, X_test_scaled, y_train, y_test, scaler


def compute_class_weights(y: np.ndarray) -> Dict[int, float]:
    """
    Compute class weights for imbalanced dataset handling.
    
    Congestion events are typically rare (imbalanced classes).
    This computes weights inversely proportional to class frequency.
    
    Args:
        y: Target array with binary labels
    
    Returns:
        Dictionary mapping class to weight
    """
    n_samples = len(y)
    n_positive = np.sum(y)
    n_negative = n_samples - n_positive
    
    # Inverse frequency weighting
    weight_positive = n_samples / (2 * max(n_positive, 1))
    weight_negative = n_samples / (2 * max(n_negative, 1))
    
    return {0: weight_negative, 1: weight_positive}


# -----------------------------------------------------------------------------
# MODEL EVALUATION
# -----------------------------------------------------------------------------

def evaluate_model(model, X_test: np.ndarray, y_test: np.ndarray) -> ModelMetrics:
    """
    Evaluate a trained model and compute all metrics.
    
    Args:
        model: Trained sklearn model
        X_test: Test features
        y_test: Test labels
    
    Returns:
        ModelMetrics object with all evaluation metrics
    """
    # Predictions
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    
    # Compute metrics
    return ModelMetrics(
        accuracy=accuracy_score(y_test, y_pred),
        precision=precision_score(y_test, y_pred, zero_division=0),
        recall=recall_score(y_test, y_pred, zero_division=0),
        f1_score=f1_score(y_test, y_pred, zero_division=0),
        roc_auc=roc_auc_score(y_test, y_proba) if len(np.unique(y_test)) > 1 else 0.5,
        confusion_matrix=confusion_matrix(y_test, y_pred)
    )


def extract_feature_importance(model, feature_names: List[str], 
                               model_type: str) -> Optional[Dict[str, float]]:
    """
    Extract feature importance from trained model.
    
    Args:
        model: Trained model
        feature_names: List of feature column names
        model_type: Type of model ('logistic', 'rf', 'gb')
    
    Returns:
        Dictionary mapping feature name to importance score
    """
    try:
        if model_type == 'logistic':
            # Use absolute coefficient values for logistic regression
            importance = np.abs(model.coef_[0])
        elif model_type in ['rf', 'gb']:
            # Tree-based models have feature_importances_
            importance = model.feature_importances_
        else:
            return None
        
        # Normalize to sum to 1
        importance = importance / np.sum(importance)
        
        # Create dictionary and sort by importance
        importance_dict = dict(zip(feature_names, importance))
        return dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))
    
    except Exception:
        return None


# -----------------------------------------------------------------------------
# MODEL TRAINING
# -----------------------------------------------------------------------------

def train_logistic_regression(X_train: np.ndarray, y_train: np.ndarray,
                              X_test: np.ndarray, y_test: np.ndarray,
                              feature_names: List[str],
                              scaler: StandardScaler) -> TrainedModel:
    """
    Train Logistic Regression model (baseline, explainable).
    
    Logistic Regression is chosen as baseline because:
    - Highly interpretable (coefficients show feature impact)
    - Fast training and inference
    - Works well with scaled features
    - Provides probability outputs naturally
    
    Args:
        X_train, y_train: Training data
        X_test, y_test: Test data
        feature_names: List of feature names
        scaler: Fitted StandardScaler
    
    Returns:
        TrainedModel object
    """
    # Compute class weights for imbalanced data
    class_weights = compute_class_weights(y_train)
    
    # Train model
    model = LogisticRegression(
        class_weight=class_weights,
        random_state=RANDOM_SEED,
        max_iter=1000,
        solver='lbfgs'
    )
    model.fit(X_train, y_train)
    
    # Evaluate
    metrics = evaluate_model(model, X_test, y_test)
    importance = extract_feature_importance(model, feature_names, 'logistic')
    
    return TrainedModel(
        name='Logistic Regression',
        model=model,
        scaler=scaler,
        feature_names=feature_names,
        metrics=metrics,
        feature_importance=importance
    )


def train_random_forest(X_train: np.ndarray, y_train: np.ndarray,
                        X_test: np.ndarray, y_test: np.ndarray,
                        feature_names: List[str],
                        scaler: StandardScaler) -> TrainedModel:
    """
    Train Random Forest model (ensemble, non-linear).
    
    Random Forest is chosen because:
    - Handles non-linear relationships well
    - Robust to outliers and noise
    - Provides feature importance
    - Less prone to overfitting than single trees
    
    Args:
        X_train, y_train: Training data
        X_test, y_test: Test data
        feature_names: List of feature names
        scaler: Fitted StandardScaler
    
    Returns:
        TrainedModel object
    """
    # Compute class weights
    class_weights = compute_class_weights(y_train)
    
    # Train model
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=10,
        min_samples_leaf=5,
        class_weight=class_weights,
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    model.fit(X_train, y_train)
    
    # Evaluate
    metrics = evaluate_model(model, X_test, y_test)
    importance = extract_feature_importance(model, feature_names, 'rf')
    
    return TrainedModel(
        name='Random Forest',
        model=model,
        scaler=scaler,
        feature_names=feature_names,
        metrics=metrics,
        feature_importance=importance
    )


def train_gradient_boosting(X_train: np.ndarray, y_train: np.ndarray,
                            X_test: np.ndarray, y_test: np.ndarray,
                            feature_names: List[str],
                            scaler: StandardScaler) -> TrainedModel:
    """
    Train Gradient Boosting model (high performance).
    
    Gradient Boosting is chosen because:
    - Often achieves best performance on tabular data
    - Builds trees sequentially to correct errors
    - Handles class imbalance well
    - Provides feature importance
    
    Args:
        X_train, y_train: Training data
        X_test, y_test: Test data
        feature_names: List of feature names
        scaler: Fitted StandardScaler
    
    Returns:
        TrainedModel object
    """
    # Compute sample weights for imbalance
    class_weights = compute_class_weights(y_train)
    sample_weights = np.array([class_weights[int(y)] for y in y_train])
    
    # Train model
    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=RANDOM_SEED
    )
    model.fit(X_train, y_train, sample_weight=sample_weights)
    
    # Evaluate
    metrics = evaluate_model(model, X_test, y_test)
    importance = extract_feature_importance(model, feature_names, 'gb')
    
    return TrainedModel(
        name='Gradient Boosting',
        model=model,
        scaler=scaler,
        feature_names=feature_names,
        metrics=metrics,
        feature_importance=importance
    )


# -----------------------------------------------------------------------------
# MAIN TRAINING PIPELINE
# -----------------------------------------------------------------------------

def train_all_models(df: pd.DataFrame,
                    feature_columns: List[str],
                    prediction_horizon: int = 1,
                    verbose: bool = True) -> Dict[str, TrainedModel]:
    """
    Train all congestion prediction models.
    
    This is the main entry point for model training. It trains all three
    models and returns them in a dictionary for comparison.
    
    Args:
        df: DataFrame with engineered features
        feature_columns: List of feature column names to use
        prediction_horizon: Number of slots ahead to predict (default 1)
        verbose: Whether to print progress messages
    
    Returns:
        Dictionary mapping model name to TrainedModel object
    """
    if verbose:
        print("\n[Model Training] Starting training pipeline...")
        print(f"  Features: {len(feature_columns)}")
        print(f"  Prediction horizon: {prediction_horizon} slot(s) ahead")
    
    # Prepare data
    if verbose:
        print("\n  [1/4] Preparing training data...")
    
    X_train, X_test, y_train, y_test, scaler = prepare_training_data(
        df, feature_columns, 
        target_column='packet_loss',
        prediction_horizon=prediction_horizon
    )
    
    if verbose:
        print(f"    Training samples: {len(X_train):,}")
        print(f"    Test samples: {len(X_test):,}")
        print(f"    Positive class ratio (train): {np.mean(y_train):.2%}")
        print(f"    Positive class ratio (test): {np.mean(y_test):.2%}")
    
    models = {}
    
    # Train Logistic Regression
    if verbose:
        print("\n  [2/4] Training Logistic Regression (baseline)...")
    models['logistic_regression'] = train_logistic_regression(
        X_train, y_train, X_test, y_test, feature_columns, scaler
    )
    if verbose:
        m = models['logistic_regression'].metrics
        print(f"    ROC-AUC: {m.roc_auc:.4f}, F1: {m.f1_score:.4f}")
    
    # Train Random Forest
    if verbose:
        print("\n  [3/4] Training Random Forest...")
    models['random_forest'] = train_random_forest(
        X_train, y_train, X_test, y_test, feature_columns, scaler
    )
    if verbose:
        m = models['random_forest'].metrics
        print(f"    ROC-AUC: {m.roc_auc:.4f}, F1: {m.f1_score:.4f}")
    
    # Train Gradient Boosting
    if verbose:
        print("\n  [4/4] Training Gradient Boosting...")
    models['gradient_boosting'] = train_gradient_boosting(
        X_train, y_train, X_test, y_test, feature_columns, scaler
    )
    if verbose:
        m = models['gradient_boosting'].metrics
        print(f"    ROC-AUC: {m.roc_auc:.4f}, F1: {m.f1_score:.4f}")
    
    if verbose:
        print("\n[Model Training] Pipeline complete.")
    
    return models


# -----------------------------------------------------------------------------
# RISK SCORE PREDICTION
# -----------------------------------------------------------------------------

def predict_congestion_risk(model: TrainedModel, 
                           df: pd.DataFrame) -> pd.DataFrame:
    """
    Predict congestion risk scores for new data.
    
    Output is a probability between 0 and 1, interpretable as:
    "likelihood of congestion in the next K slots"
    
    Args:
        model: Trained model object
        df: DataFrame with feature columns
    
    Returns:
        DataFrame with original data plus 'congestion_risk_score' column
    """
    result = df.copy()
    
    # Ensure all required features exist
    missing_features = [f for f in model.feature_names if f not in df.columns]
    if missing_features:
        raise ValueError(f"Missing required features: {missing_features}")
    
    # Predict probabilities
    risk_scores = model.predict_proba(df)
    
    # Add to DataFrame
    result['congestion_risk_score'] = risk_scores
    
    return result


def get_risk_category(risk_score: float) -> str:
    """
    Convert numeric risk score to human-readable category.
    
    Categories:
    - Low: 0.0 - 0.25
    - Medium: 0.25 - 0.50
    - High: 0.50 - 0.75
    - Critical: 0.75 - 1.0
    
    Args:
        risk_score: Probability between 0 and 1
    
    Returns:
        Risk category string
    """
    if risk_score < 0.25:
        return "Low"
    elif risk_score < 0.50:
        return "Medium"
    elif risk_score < 0.75:
        return "High"
    else:
        return "Critical"


# -----------------------------------------------------------------------------
# MODEL COMPARISON
# -----------------------------------------------------------------------------

def compare_models(models: Dict[str, TrainedModel], 
                  verbose: bool = True) -> Tuple[str, pd.DataFrame]:
    """
    Compare all trained models and determine the best one.
    
    Selection criteria (in order of importance):
    1. ROC-AUC: Overall discrimination ability
    2. F1-Score: Balance between precision and recall
    3. Recall: Important for catching congestion events
    
    Args:
        models: Dictionary of trained models
        verbose: Whether to print comparison table
    
    Returns:
        Tuple of (best_model_name, metrics_dataframe)
    """
    # Collect metrics
    metrics_data = []
    for name, model in models.items():
        m = model.metrics.to_dict()
        m['model'] = model.name
        metrics_data.append(m)
    
    metrics_df = pd.DataFrame(metrics_data)
    metrics_df = metrics_df[['model', 'accuracy', 'precision', 'recall', 'f1_score', 'roc_auc']]
    
    # Determine best model by ROC-AUC
    best_idx = metrics_df['roc_auc'].idxmax()
    best_model_key = list(models.keys())[best_idx]
    
    if verbose:
        print("\n" + "=" * 70)
        print("  MODEL COMPARISON")
        print("=" * 70)
        print(metrics_df.to_string(index=False))
        print("-" * 70)
        print(f"  BEST MODEL: {models[best_model_key].name}")
        print(f"  Selection criteria: Highest ROC-AUC ({metrics_df.loc[best_idx, 'roc_auc']:.4f})")
        print("=" * 70)
    
    return best_model_key, metrics_df


def get_top_features(model: TrainedModel, n: int = 10) -> List[Tuple[str, float]]:
    """
    Get top N most important features from a model.
    
    Args:
        model: Trained model with feature importance
        n: Number of top features to return
    
    Returns:
        List of (feature_name, importance_score) tuples
    """
    if model.feature_importance is None:
        return []
    
    return list(model.feature_importance.items())[:n]

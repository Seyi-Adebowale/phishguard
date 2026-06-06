"""
PhishGuard — Model Training Script
===================================
Trains a Random Forest classifier on the phishing websites dataset
and exports the model to JSON for browser-based inference.

Usage:
    python train_model.py --data dataset.csv --output public/model.json

Requirements:
    pip install scikit-learn pandas numpy
"""

import argparse
import json
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score, classification_report,
    confusion_matrix, roc_auc_score
)
from sklearn.tree import _tree


# ─────────────────────────────────────────────
# 1.  Load & inspect data
# ─────────────────────────────────────────────

def load_data(path):
    df = pd.read_csv(path)
    
    # Drop features that rely on backend data or are no longer extracted
    drop_cols = [
        'Domain_registeration_length',
        'age_of_domain',
        'web_traffic',
        'Page_Rank',
        'Google_Index',
        'Links_pointing_to_page',
        'Statistical_report'
    ]
    df = df.drop(columns=drop_cols, errors='ignore')
    
    print(f"\n[DATA] Dataset: {df.shape[0]} rows x {df.shape[1]} columns")
    print(f"   Classes: {df['Result'].value_counts().to_dict()}")
    print(f"   Features: {df.shape[1] - 2}  (excluding index & target)")
    print(f"   Missing values: {df.isnull().sum().sum()}")

    feature_cols = [c for c in df.columns if c not in ['index', 'Result']]
    X = df[feature_cols].values
    y = df['Result'].values  # -1 = phishing, 1 = legitimate
    return X, y, feature_cols


# ─────────────────────────────────────────────
# 2.  Train & evaluate
# ─────────────────────────────────────────────

def train_and_evaluate(X, y, n_estimators=30, max_depth=7, random_state=42):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=random_state, stratify=y
    )

    print(f"\n[TRAIN] Training Random Forest ({n_estimators} trees, max_depth={max_depth})...")
    rf = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        random_state=random_state,
        n_jobs=-1,
        class_weight='balanced',
    )
    rf.fit(X_train, y_train)

    y_pred = rf.predict(X_test)
    y_prob = rf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)

    print(f"\n[OK] Test Accuracy : {acc:.4f} ({acc*100:.1f}%)")
    print(f"   ROC-AUC Score : {auc:.4f}")
    print(f"\n{classification_report(y_test, y_pred, target_names=['Phishing','Legitimate'])}")

    cm = confusion_matrix(y_test, y_pred)
    print(f"Confusion Matrix:\n{cm}")

    # Cross-validation
    cv_scores = cross_val_score(rf, X, y, cv=5, scoring='accuracy', n_jobs=-1)
    print(f"\n5-Fold CV Accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    return rf, acc


# ─────────────────────────────────────────────
# 3.  Export model to JSON
# ─────────────────────────────────────────────

def tree_to_array(estimator):
    """Serialize a decision tree as a compact nested array.
    
    Format:
        Node: [feature_index, threshold, left_subtree, right_subtree]
        Leaf: [prob_class_0, prob_class_1]
    """
    t = estimator.tree_

    def recurse(node):
        if t.feature[node] == _tree.TREE_UNDEFINED:
            # Leaf — return class probabilities
            counts = t.value[node][0]
            total = counts.sum()
            return [round(float(c / total), 3) for c in counts]
        return [
            int(t.feature[node]),
            round(float(t.threshold[node]), 3),
            recurse(t.children_left[node]),
            recurse(t.children_right[node]),
        ]

    return recurse(0)


def export_model(rf, feature_cols, accuracy, output_path):
    importances = {
        col: round(float(imp) * 100, 2)
        for col, imp in zip(feature_cols, rf.feature_importances_)
    }

    model_data = {
        'f':   feature_cols,              # feature names
        'c':   list(rf.classes_.tolist()), # class labels [-1, 1]
        't':   [tree_to_array(est) for est in rf.estimators_],
        'acc': round(accuracy * 100, 1),
        'imp': importances,
        'meta': {
            'n_trees':   len(rf.estimators_),
            'max_depth': rf.max_depth,
            'n_samples': 11055,
            'algorithm': 'Random Forest',
        }
    }

    json_str = json.dumps(model_data, separators=(',', ':'))
    with open(output_path, 'w') as f:
        f.write(json_str)

    size_kb = len(json_str) / 1024
    print(f"\n[SAVE] Model saved -> {output_path}  ({size_kb:.1f} KB)")
    print(f"   Trees: {len(rf.estimators_)}")
    print(f"   Top features:")
    top = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:5]
    for name, imp in top:
        print(f"     {imp:5.1f}%  {name}")


# ─────────────────────────────────────────────
# 4.  Main
# ─────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train PhishGuard Random Forest')
    parser.add_argument('--data',   default='dataset.csv',        help='Path to dataset CSV')
    parser.add_argument('--output', default='public/model.json',  help='Output JSON path')
    parser.add_argument('--trees',  type=int, default=30,         help='Number of trees')
    parser.add_argument('--depth',  type=int, default=7,          help='Max tree depth')
    args = parser.parse_args()

    X, y, feature_cols = load_data(args.data)
    rf, acc = train_and_evaluate(X, y, n_estimators=args.trees, max_depth=args.depth)
    export_model(rf, feature_cols, acc, args.output)

    print("\n[DONE] Deploy the React app and the model will load automatically.")

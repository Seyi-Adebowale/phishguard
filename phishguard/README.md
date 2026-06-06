# PhishSentinel — AI-Powered Phishing Website Detector

A production-grade phishing detection web app that runs entirely in the browser. No backend required, no data ever sent to a server.

---

## Project Overview

PhishSentinel uses a **Random Forest classifier** trained on 11,055 real-world URLs to classify websites as phishing or legitimate. The trained model is exported to JSON and loaded at runtime for instant, privacy-first inference.

### Results

| Metric | Value |
|--------|-------|
| Training samples | 11,055 |
| Test accuracy | **93.5%** |
| Algorithm | Random Forest (30 trees, depth 7) |
| Model size | ~41 KB |
| Inference | In-browser (JavaScript) |

### Top Predictive Features

1. **SSL Certificate** (31.97% importance) — HTTP-only sites are a strong phishing signal
2. **URL of Anchor** (25.0%) — percentage of anchor tags pointing off-domain  
3. **Web Traffic** (7.08%) — low-traffic domains are suspicious
4. **Subdomain Count** (6.95%) — excessive subdomains indicate spoofing
5. **Links in Tags** (4.39%) — suspicious link patterns in page tags

---

## Tech Stack

- **Frontend**: React 18, Tailwind CSS
- **ML Model**: scikit-learn Random Forest → exported JSON
- **Inference**: Custom JavaScript decision tree traversal (no ML library needed)
- **Deployment**: Netlify / Vercel (free tier)

---

## Project Structure

```
PhishSentinel/
├── public/
│   ├── index.html          # Entry HTML
│   └── model.json          # Trained RF model (30 trees, 41KB)
├── src/
│   ├── App.js              # Main application
│   ├── model.js            # RF inference engine + URL feature extraction
│   ├── index.js            # React entry point
│   ├── index.css           # Global styles + animations
│   └── components/
│       ├── ResultCard.js   # Detection result with confidence ring
│       ├── FeatureImportance.js  # Top features visualization
│       └── StatsBar.js     # Session stats panel
├── tailwind.config.js
├── postcss.config.js
├── vercel.json             # Vercel deployment config
├── netlify.toml            # Netlify deployment config
└── package.json
```

---

## How It Works

### Training (Python / scikit-learn)

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

# Dataset: 11,055 samples, 30 binary/ternary features
# Values: -1 (suspicious), 0 (neutral), 1 (legitimate)
# Target: -1 = phishing, 1 = legitimate

rf = RandomForestClassifier(n_estimators=30, max_depth=7, random_state=42)
rf.fit(X_train, y_train)
# Accuracy: 93.5%
```

### Model Export

Each decision tree is serialized as a nested array:
- **Node**: `[featureIndex, threshold, leftChild, rightChild]`
- **Leaf**: `[prob_phishing, prob_legitimate]`

### Browser Inference

```javascript
function predictTree(node, features) {
  if (node.length === 2) return node;  // leaf
  const [featIdx, threshold, left, right] = node;
  return features[featIdx] <= threshold
    ? predictTree(left, features)
    : predictTree(right, features);
}

// Average predictions across all 30 trees
for (const tree of model.trees) {
  const probs = predictTree(tree, featureVector);
  // aggregate...
}
```

### URL Feature Extraction

The app extracts 30 features from a URL in real-time:
- IP address in URL
- URL length  
- Shortening service detection
- @ symbol presence
- HTTPS vs HTTP
- Subdomain count
- Non-standard ports
- "https" keyword in domain name
- And more...

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

---

## Deploy to Netlify (Free)

1. Push to GitHub
2. Connect repo on [netlify.com](https://netlify.com)
3. Build command: `npm run build`
4. Publish directory: `build`
5. Deploy!

## Deploy to Vercel (Free)

```bash
npm install -g vercel
vercel
```
Or connect your GitHub repo at [vercel.com](https://vercel.com).

---

## Dataset

- **Source**: UCI Phishing Websites Dataset
- **11,055 samples**: 6,157 legitimate, 4,898 phishing
- **30 features**: URL-based, page-content-based, domain-based
- **Encoding**: -1 (phishing indicator), 0 (neutral), 1 (legitimate indicator)

---

## Limitations

Some features (web traffic, page rank, DNS records, links in page) cannot be extracted from a URL alone without making external requests. The app uses neutral/estimated values for these. The strongest signals (SSL, URL structure, subdomains) are extracted accurately.

For a production system, integrate a backend service to fetch full page content features.

---

## Academic Note

This project demonstrates:
- End-to-end ML pipeline from raw dataset to deployed application
- Model serialization and client-side inference
- Feature engineering from structured data
- Privacy-preserving design (no data leaves client)

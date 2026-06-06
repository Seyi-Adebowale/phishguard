# PhishGuard: AI-Powered Client-Side Phishing Detection

## 1. Introduction & Overview
PhishGuard is a modern, privacy-preserving web application designed to detect phishing websites in real-time. Unlike traditional anti-phishing tools that rely on backend servers to process data, PhishGuard performs all feature extraction and machine learning inference entirely **client-side** (within the user's browser). This architecture ensures rapid response times and guarantees that the user's browsing data is never transmitted to a centralized processing server.

## 2. Technology Stack
The project is built on a hybrid stack combining modern web technologies for the frontend and Python for offline model training:
- **Frontend Framework:** React.js
- **Styling:** Tailwind CSS (configured for a premium, dark-mode cyberpunk aesthetic)
- **Machine Learning (Training):** Python, `scikit-learn`, `pandas`, `numpy`
- **Machine Learning (Inference):** Custom JavaScript Random Forest implementation.
- **External APIs:** `api.allorigins.win` (CORS proxy for HTML fetching), Google DNS-over-HTTPS (for DNS verification).

## 3. Dataset & Feature Engineering
The initial dataset was based on standard academic phishing datasets (e.g., the UCI Machine Learning Repository Phishing Website Dataset), which traditionally contain 30 heuristic features. 

However, because PhishGuard is engineered to run client-side, **7 backend-dependent features were explicitly dropped** from the dataset prior to training. Features such as *Domain Age, PageRank, Google Index, Web Traffic, and Statistical Reports* require expensive API calls to third-party SEO and registrar services, which cannot be securely or reliably performed from a browser.

The dataset was thus refined to **23 critical features** that can be extracted instantaneously from the URL string and the webpage's Document Object Model (DOM).

### The 23 Features & Their Importance
The features are divided into three core categories:

#### A. URL & Structural Features
1. **IP Address Used:** Phishers often use raw IP addresses (e.g., `192.168.1.1`) instead of domain names.
2. **URL Length:** Excessively long URLs are often used to hide suspicious paths.
3. **Shortening Services:** Detection of services like `bit.ly` or `tinyurl` which hide the true destination.
4. **@ Symbol:** Browsers ignore everything before the `@` symbol, a classic trick to spoof domain names.
5. **Double Slash Redirect:** `//` appearing after the protocol indicates a stealthy redirect.
6. **Prefix/Suffix (Dash):** Legitimate sites rarely use dashes (`-`) in their domain names.
7. **Subdomain Count:** Deeply nested subdomains (e.g., `login.secure.billing.apple.com.badsite.net`) are highly suspicious.
8. **HTTPS/SSL State:** Evaluates if the explicit protocol used is secure.
9. **Port Status:** Checks if non-standard ports are appended to the URL.
10. **HTTPS in Domain:** Spoofing the word "https" directly into the domain name (e.g., `https-paypal.com`).

#### B. DOM / HTML Features
11. **Favicon Source:** Phishing sites often load the real company's Favicon from an external CDN.
12. **Request URL:** Calculates the ratio of media (images/videos) loaded from external domains.
13. **Anchor URLs:** Evaluates if navigation links point to external domains or empty fragments (`#`).
14. **Links in Tags:** Checks if CSS `<link>` and `<script>` tags rely on external domains.
15. **Server Form Handler (SFH):** Analyzes `<form>` action attributes. Empty actions or actions pointing to suspicious domains indicate credential harvesting.
16. **Email Submission:** Checks for `mailto:` actions in forms, a primitive method for stealing data.
17. **Abnormal URL:** Cross-references the hostname with WHOIS and embedded configurations.
18. **IFrame Usage:** Detects hidden `<iframe>` tags used to invisibly load malicious content.

#### C. Behavioral & Network Features
19. **Redirects:** Calculates the number of hops to reach the final destination.
20. **OnMouseOver Event:** Detects JavaScript designed to alter the status bar to spoof the visible link.
21. **Right-Click Disabled:** Phishers disable right-clicking to prevent users from inspecting the source code.
22. **Popup Windows:** Identifies aggressive credential-prompt popups.
23. **DNS Record:** Performs a live DNS lookup to ensure the domain actually exists and is registered.

## 4. Model Training & Conversion
The core detection engine is a **Random Forest Classifier**.

### Why Random Forest?
The Random Forest algorithm was specifically chosen over other models (like Neural Networks or Support Vector Machines) for several key reasons:
1. **High Exportability to JavaScript:** A Random Forest is fundamentally a collection of nested `if/else` decision trees. This allows the model to be easily serialized into a lightweight JSON file and executed natively in vanilla JavaScript, completely eliminating the need for heavy client-side ML libraries (like TensorFlow.js).
2. **Explainability:** Random Forests natively calculate "Feature Importance" (Gini importance). This allows the application to be transparent with the user by showing exactly *which* features contributed most to the final verdict.
3. **Non-linear Data:** Phishing indicators are highly non-linear (e.g., an `@` symbol in a URL combined with a missing Favicon). Random Forests excel at capturing these complex, interlocking patterns without requiring extensive feature scaling.
4. **Robustness:** By averaging the votes of 30 independent decision trees, the model mitigates the overfitting issues common to single decision trees, ensuring high accuracy on unseen live websites.

1. **Training (Offline):** A Python script (`train_model.py`) loads the refined 23-feature dataset using `pandas`. It splits the data into training and testing sets, and trains a `scikit-learn` Random Forest Classifier configured with **30 estimators (decision trees)**.
2. **Evaluation:** The model achieves roughly **93.4% accuracy** on unseen data, balancing precision and recall perfectly for web environments.
3. **Serialization:** Because we cannot run Python in the browser without massive overhead (like WebAssembly), the trained model's mathematical structure (the split thresholds, feature indices, and leaf values of all 30 trees) is exported into a lightweight JSON file (`model.json`).
4. **Feature Importance:** During training, `scikit-learn` calculates the "Feature Importance" (Gini importance) of each variable, which is also exported to the JSON file to power the UI's analytics dashboard.

## 5. System Architecture: How It Works
When a user interacts with PhishGuard, the following real-time sequence occurs:

1. **Input Validation:** The user pastes a URL. The React frontend enforces strict protocol validation, requiring the user to explicitly define `http://` or `https://`.
2. **Proxy Fetching:** The app sends the URL to `api.allorigins.win`. This CORS proxy fetches the live HTML of the target website and returns it to the browser. Simultaneously, a DNS-over-HTTPS request is dispatched to Google's DNS servers.
3. **Client-Side Extraction (`model.js`):**
   - The app parses the URL string with regex to calculate structural features (Length, Subdomains, Shorteners).
   - The fetched HTML is injected into an isolated `DOMParser` instance. JavaScript queries (`doc.querySelectorAll`) scour the virtual DOM for iframes, form actions, favicons, and media tags.
   - The resulting data is compressed into a 23-dimensional numerical array `[1, -1, 0, 1...]`.
4. **Inference:** The JavaScript inference engine reads `model.json`. It passes the 23-dimension array through all 30 decision trees.   
5. **Overrides:** The system applies deterministic security heuristics. If an IP address is used instead of a domain name, or if the user is targeted by a typosquatting attack, the ML probability is overridden, and the site is clamped to a "Phishing" verdict to guarantee safety.
6. **Rendering:** The React UI dynamically renders the final Confidence Score, explicitly lists the triggered "Areas of Concern," and generates the Feature Importance graph based on the exported model weights.

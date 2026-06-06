// Random Forest inference engine
// Runs entirely in the browser — no API calls needed

let cachedModel = null;

export async function loadModel() {
  if (cachedModel) return cachedModel;
  const res = await fetch('/model.json');
  cachedModel = await res.json();
  return cachedModel;
}

function predictTree(node, features) {
  // node is either [featIdx, threshold, left, right] or [prob_class0, prob_class1] (leaf)
  if (node.length === 2) return node; // leaf: [p(-1), p(1)]
  const [featIdx, threshold, left, right] = node;
  if (features[featIdx] <= threshold) {
    return predictTree(left, features);
  } else {
    return predictTree(right, features);
  }
}

export function predict(model, featureValues) {
  // featureValues: array in same order as model.f
  const probs = [0, 0];
  for (const tree of model.t) {
    const leafProbs = predictTree(tree, featureValues);
    probs[0] += leafProbs[0];
    probs[1] += leafProbs[1];
  }
  const n = model.t.length;
  const p0 = probs[0] / n; // P(phishing)  class = -1
  const p1 = probs[1] / n; // P(legitimate) class = 1

  const isPhishing = p0 > p1;
  const confidence = isPhishing ? p0 : p1;

  return {
    isPhishing,
    confidence: Math.round(confidence * 100),
    phishingProb: Math.round(p0 * 100),
    legitimateProb: Math.round(p1 * 100),
  };
}

// Typosquatting / homograph detection
const BRAND_DOMAINS = {
  'google': ['google.com','google.co.uk','google.co.in','google.ca','google.com.au','google.de','google.fr','google.co.jp'],
  'facebook': ['facebook.com'],
  'instagram': ['instagram.com'],
  'twitter': ['twitter.com','x.com'],
  'paypal': ['paypal.com','paypal.me'],
  'apple': ['apple.com','icloud.com'],
  'microsoft': ['microsoft.com','live.com','outlook.com','hotmail.com','office.com'],
  'amazon': ['amazon.com','amazon.co.uk','amazon.de','amazon.ca','amazon.in'],
  'netflix': ['netflix.com'],
  'linkedin': ['linkedin.com'],
  'github': ['github.com'],
  'dropbox': ['dropbox.com'],
  'chase': ['chase.com'],
  'bankofamerica': ['bankofamerica.com'],
  'wellsfargo': ['wellsfargo.com'],
  'yahoo': ['yahoo.com'],
  'steam': ['steampowered.com','steamcommunity.com'],
  'spotify': ['spotify.com'],
  'whatsapp': ['whatsapp.com'],
  'discord': ['discord.com','discord.gg'],
  'reddit': ['reddit.com'],
  'tiktok': ['tiktok.com'],
  'snapchat': ['snapchat.com'],
  'uber': ['uber.com'],
  'ebay': ['ebay.com','ebay.co.uk'],
  'walmart': ['walmart.com'],
  'adobe': ['adobe.com'],
  'zoom': ['zoom.us'],
  'slack': ['slack.com'],
  'twitch': ['twitch.tv'],
};

const CHAR_SUBS = {
  '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's',
  '6': 'g', '7': 't', '8': 'b', '9': 'g', '@': 'a',
};

function normalizeChars(str) {
  let result = str.split('').map(c => CHAR_SUBS[c] || c).join('');
  // Common multi-char substitutions
  result = result.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/cl/g, 'd');
  return result;
}

export function detectTyposquatting(hostname) {
  const clean = hostname.replace(/^www\./, '').toLowerCase();
  const parts = clean.split('.');
  // Get the registrable domain (last two parts, or last three for co.uk etc.)
  const tldPatterns = ['co.uk', 'co.in', 'com.au', 'co.jp'];
  let domainBase;
  const suffix = parts.slice(-2).join('.');
  if (tldPatterns.includes(suffix) && parts.length > 2) {
    domainBase = parts.slice(0, -2).join('.');
  } else {
    domainBase = parts.slice(0, -1).join('.');
  }

  const normalized = normalizeChars(domainBase);

  for (const [brand, legitimateDomains] of Object.entries(BRAND_DOMAINS)) {
    // Check if normalized domain matches the brand exactly or contains it
    const isExactMatch = normalized === brand;
    const containsBrand = brand.length >= 4 && normalized.includes(brand) && normalized !== brand;

    if (isExactMatch || containsBrand) {
      // Verify it's NOT actually a legitimate domain for this brand
      const isLegitimate = legitimateDomains.some(d => clean === d || clean.endsWith('.' + d));
      if (!isLegitimate) {
        return brand;
      }
    }
  }
  return null;
}

// Extract features from a URL for real-time analysis
export async function extractFeatures(url, onProgress) {
  try {
    if (onProgress) onProgress("Parsing URL structure...");
    const urlObj = new URL(url);
    const fullUrl = url;
    const hostname = urlObj.hostname;
    const path = urlObj.pathname;

    // 1. having_IPhaving_IP_Address: IP in URL = -1 (phishing), else 1
    const hasIP = /(\d{1,3}\.){3}\d{1,3}/.test(hostname);

    // 2. URLURL_Length: >75 = -1, 54-75 = 0, <54 = 1
    const urlLen = fullUrl.length;
    const urlLength = urlLen < 54 ? 1 : urlLen <= 75 ? 0 : -1;

    // 3. Shortining_Service
    const shorteners = ['bit.ly','tinyurl.com','goo.gl','ow.ly','t.co','buff.ly','short.io','is.gd','cli.gs','yfrog.com','migre.me','ff.im','tiny.cc','url4.eu','tr.im','twit.ac','su.pr','twurl.nl','snipurl.com','short.to','budurl.com','ping.fm','post.ly','just.as','bkite.com','snipr.com','flic.kr','loopt.us','doiop.com','twitthis.com','htxt.it','alturl.com','redirx.com','digbig.com'];
    const lowerHostname = hostname.toLowerCase();
    const isShortened = shorteners.some(s => lowerHostname === s || lowerHostname.endsWith('.' + s) || lowerHostname.startsWith('tinyurl') || lowerHostname.startsWith('bit.ly'));

    // 4. having_At_Symbol
    const hasAt = fullUrl.includes('@');

    // 5. double_slash_redirecting
    const hasDoubleSlash = path.includes('//');

    // 6. Prefix_Suffix: dash in domain = -1
    const hasDash = hostname.includes('-');

    // 7. having_Sub_Domain: subdomains count
    const parts = hostname.replace('www.', '').split('.');
    const subDomainScore = hasIP ? 1 : parts.length <= 2 ? 1 : parts.length === 3 ? 0 : -1;

    // 8. SSLfinal_State: https = 1, http = -1
    const hasSSL = url.startsWith('https') || urlObj.protocol === 'https:';
    const sslState = hasSSL ? 1 : -1;


    // 10. port: non-standard port = -1
    const port = urlObj.port && !['80','443',''].includes(urlObj.port) ? -1 : 1;

    // 11. HTTPS_token: 'https' in domain name (not protocol) = -1
    const httpsToken = hostname.includes('https') ? -1 : 1;

    // 16. Submitting_to_email: mailto in form? assume 1
    const submittingToEmail = fullUrl.includes('mailto:') ? -1 : 1;

    // 17. Abnormal_URL: hostname matches common pattern?
    const abnormalUrl = hostname.split('.').slice(-2).join('.').length < 5 ? -1 : 1;

    // 18. Redirect: multiple // after protocol
    const redirect = (fullUrl.match(/\/\//g) || []).length > 1 ? 1 : 0;

    // ---- LIVE DATA EXTRACTION ----
    let dnsRecord = 1; // Default to assumed positive
    let favicon = 1;
    let requestUrl = 1;
    let urlOfAnchor = 0;
    let linksInTags = 0;
    let sfh = 0;
    let onMouseover = 1;
    let rightClick = 1;
    let popUpWindow = 1;
    let iframe = 1;

    // Fetch DNS over HTTPS
    if (onProgress) onProgress("Resolving DNS records...");
    try {
      const dnsController = new AbortController();
      const dnsTimeout = setTimeout(() => dnsController.abort(), 4000);
      const dnsRes = await fetch(`https://dns.google/resolve?name=${hostname}`, { signal: dnsController.signal });
      clearTimeout(dnsTimeout);
      const dnsData = await dnsRes.json();
      dnsRecord = dnsData.Status === 0 ? 1 : -1;
    } catch (e) {
      console.warn("DNS lookup failed", e);
    }

    // Fetch HTML via CORS Proxy
    if (onProgress) onProgress("Fetching live HTML...");
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(fullUrl)}`;
      const htmlController = new AbortController();
      const htmlTimeout = setTimeout(() => htmlController.abort(), 8000);
      const htmlRes = await fetch(proxyUrl, { signal: htmlController.signal });
      clearTimeout(htmlTimeout);
      const data = await htmlRes.json();
      if (data.contents) {
        if (onProgress) onProgress("Extracting DOM features...");
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        const rawHtml = data.contents.toLowerCase();

        // 10. Favicon
        const iconLink = doc.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
        if (iconLink && iconLink.href && new URL(iconLink.href, fullUrl).hostname !== hostname) {
          favicon = -1;
        }

        // 13. Request URL (images, videos, audio)
        const mediaElements = Array.from(doc.querySelectorAll('img, video, audio'));
        let extMedia = 0;
        mediaElements.forEach(el => {
          if (el.src && new URL(el.src, fullUrl).hostname !== hostname) extMedia++;
        });
        if (mediaElements.length > 0) {
          const ratio = extMedia / mediaElements.length;
          requestUrl = ratio < 0.22 ? 1 : ratio < 0.61 ? 0 : -1;
        }

        // 14. URL of Anchor
        const anchors = Array.from(doc.querySelectorAll('a'));
        let extAnchors = 0;
        anchors.forEach(a => {
          try {
            if (a.href && !a.href.startsWith('javascript') && !a.href.startsWith('#') && new URL(a.href, fullUrl).hostname !== hostname) extAnchors++;
          } catch { /* ignore */ }
        });
        if (anchors.length > 0) {
          const ratio = extAnchors / anchors.length;
          urlOfAnchor = ratio < 0.31 ? 1 : ratio < 0.67 ? 0 : -1;
        }

        // 15. Links in tags
        const links = Array.from(doc.querySelectorAll('link, script, meta'));
        let extLinks = 0;
        links.forEach(l => {
          const src = l.href || l.src || l.content;
          try {
            if (src && src.startsWith('http') && new URL(src, fullUrl).hostname !== hostname) extLinks++;
          } catch { /* ignore invalid URLs */ }
        });
        if (links.length > 0) {
          const ratio = extLinks / links.length;
          linksInTags = ratio < 0.17 ? 1 : ratio < 0.81 ? 0 : -1;
        }

        // 16. Server Form Handler (SFH)
        const forms = Array.from(doc.querySelectorAll('form'));
        if (forms.length > 0) sfh = 1; // default positive if forms exist and are fine
        forms.forEach(f => {
          const action = f.getAttribute('action');
          if (!action || action === 'about:blank' || action === '') {
            sfh = -1;
          } else {
            try {
              const formDomain = new URL(action, fullUrl).hostname;
              if (formDomain !== hostname) sfh = 0; // suspicious if external but valid
            } catch {
              sfh = -1; // invalid URL
            }
          }
        });

        // 20-22. Behavior
        if (onProgress) onProgress("Running behavior analysis...");
        if (rawHtml.includes('onmouseover=')) onMouseover = -1;
        if (rawHtml.includes('event.button==2') || rawHtml.includes('event.button == 2')) rightClick = -1;
        if (rawHtml.includes('window.open(')) popUpWindow = -1;
        
        // 23. Iframe
        const iframes = doc.querySelectorAll('iframe');
        if (iframes.length > 0) iframe = -1;
      }
    } catch (e) {
      console.warn("HTML proxy fetch failed", e);
    }

    if (onProgress) onProgress("Finalizing scoring...");
    const features = [
      hasIP ? -1 : 1,        // 1. having_IP_Address
      urlLength,              // 2. URL_Length
      isShortened ? -1 : 1,  // 3. Shortining_Service
      hasAt ? -1 : 1,        // 4. having_At_Symbol
      hasDoubleSlash ? -1 : 1, // 5. double_slash_redirecting
      hasDash ? -1 : 1,      // 6. Prefix_Suffix
      subDomainScore,        // 7. having_Sub_Domain
      sslState,              // 8. SSLfinal_State
      favicon,               // 9. Favicon
      port,                  // 10. port
      httpsToken,            // 11. HTTPS_token
      requestUrl,            // 12. Request_URL
      urlOfAnchor,           // 13. URL_of_Anchor
      linksInTags,           // 14. Links_in_tags
      sfh,                   // 15. SFH
      submittingToEmail,     // 16. Submitting_to_email
      abnormalUrl,           // 17. Abnormal_URL
      redirect,              // 18. Redirect
      onMouseover,           // 19. on_mouseover
      rightClick,            // 20. RightClick
      popUpWindow,           // 21. popUpWidnow
      iframe,                // 22. Iframe
      dnsRecord,             // 23. DNSRecord
    ];

    const featureNames = [
      'IP Address in URL', 'URL Length', 'Shortening Service', 'At Symbol',
      'Double Slash Redirect', 'Prefix/Suffix Dash', 'Subdomain Count', 'SSL Certificate',
      'Favicon', 'Port', 'HTTPS in Domain', 'Request URL',
      'Anchor URL', 'Links in Tags', 'Server Form Handler', 'Email Submission',
      'Abnormal URL', 'Redirect Count', 'Mouseover Events', 'Right Click',
      'Popup Window', 'iFrame', 'DNS Record'
    ];

    const detectedFlags = [];
    if (hasIP) detectedFlags.push('IP address used instead of domain name');
    if (urlLen > 75) detectedFlags.push(`Suspicious URL length (${urlLen} chars)`);
    if (isShortened) detectedFlags.push('URL shortening service detected');
    if (hasAt) detectedFlags.push('@ symbol in URL');
    if (hasDoubleSlash) detectedFlags.push('Double slash redirect in path');
    if (hasDash) detectedFlags.push('Hyphen/dash in domain name');
    if (!hasIP && parts.length > 3) detectedFlags.push('Excessive subdomains');
    if (!hasSSL) detectedFlags.push('No HTTPS/SSL certificate');
    if (hostname.includes('https')) detectedFlags.push('"https" word in domain (spoofing)');
    if (port === -1) detectedFlags.push('Non-standard port in URL');
    if (dnsRecord === -1) detectedFlags.push('No valid DNS record found');
    if (sfh === -1) detectedFlags.push('Suspicious or empty form action handler');
    if (iframe === -1) detectedFlags.push('Embedded iframe detected');

    // Typosquatting detection
    const typosquattingBrand = detectTyposquatting(hostname);
    if (typosquattingBrand) {
      detectedFlags.unshift(`Possible typosquatting: looks like ${typosquattingBrand}.com`);
    }

    return { features, featureNames, detectedFlags, hostname, hasSSL, urlLength: urlLen, typosquattingBrand };
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Map feature importance from model to display names
export function getTopFeatures(model) {
  const displayNames = {
    'having_IPhaving_IP_Address': 'IP Address in URL',
    'URLURL_Length': 'URL Length',
    'Shortining_Service': 'Shortening Service',
    'having_At_Symbol': 'At Symbol (@)',
    'double_slash_redirecting': 'Double Slash Redirect',
    'Prefix_Suffix': 'Prefix/Suffix (Dash)',
    'having_Sub_Domain': 'Subdomain Count',
    'SSLfinal_State': 'SSL Certificate',
    'Favicon': 'Favicon',
    'port': 'Port',
    'HTTPS_token': 'HTTPS in Domain Name',
    'Request_URL': 'Request URL',
    'URL_of_Anchor': 'Anchor URL',
    'Links_in_tags': 'Links in Tags',
    'SFH': 'Server Form Handler',
    'Submitting_to_email': 'Email Submission',
    'Abnormal_URL': 'Abnormal URL',
    'Redirect': 'Redirect Count',
    'on_mouseover': 'Mouseover Events',
    'RightClick': 'Right Click Disabled',
    'popUpWidnow': 'Popup Window',
    'Iframe': 'iFrame Usage',
    'DNSRecord': 'DNS Record',
  };
  return Object.entries(model.imp || {})
    .map(([k, v]) => ({ key: k, name: displayNames[k] || k, importance: v }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10);
}

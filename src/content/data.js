// Shared data: cosmetic selector packs, focus presets and default settings.
// Loaded as a content script (before cosmetic.js), and by the popup/options/background via importScripts/<script>.
(function (root) {
  'use strict';

  const CATEGORIES = {
    ads: {
      label: 'Ads',
      desc: 'Ad slots, sponsored widgets and ad iframes',
      selectors: [
        'ins.adsbygoogle', '.adsbygoogle', '[id^="div-gpt-ad"]', '[id^="google_ads_iframe"]', '[id^="google_ads"]',
        'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]', 'iframe[src*="adnxs.com"]',
        'iframe[src*="amazon-adsystem.com"]', 'iframe[src*="taboola.com"]', 'iframe[src*="outbrain.com"]',
        '[data-google-query-id]', '[data-ad-slot]', '[data-adunit]', '[data-ad-unit]', '[data-ad-client]',
        '.taboola', '.trc_related_container', '#taboola-below-article-thumbnails', '[id^="taboola-"]',
        '.OUTBRAIN', '.ob-widget', '[data-widget-id^="AR_"]',
        '.amzn-native-ad', '.amzn-native-container',
        '[id^="celtra-"]', '[class*="celtra"]',
        '.ad-container', '.ad-slot', '.ad-wrapper', '.ad-banner', '.ad-box', '.ad-unit', '.ad-placeholder',
        '.sidebar-ad', '.advertisement', '.advert', '.sponsored-post', '.sponsored-content', '.sponsoredLinks',
        '.AdContainer', '.AdSense', '.AdUnit', '.Banner300x250', '.ContentAds', '.SidebarAd', '.SponsoredLinks',
        '#AdContainer', '#BannerAd', '#BottomAdContainer', '#ContentAd', '#FooterAd', '#GoogleAd', '#HeaderAd',
        '#SidebarAd', '#TopAd', '#ad-banner', '#ad-container', '#ad-sidebar', '#adsense', '#sponsor-ad',
        '[aria-label="Advertisement"]', '[aria-label="advertisement"]', '[aria-label="Ads"]',
        '[data-testid="ad"]', '[data-testid="adBanner"]', '[data-ad-placeholder]',
        'a[href*="doubleclick.net/"]', 'a[href*="googleadservices.com/"]',
        'shreddit-ad-post', '[data-testid="post-ad"]', 'ytd-ad-slot-renderer', 'ytd-display-ad-renderer',
        'ytd-promoted-sparkles-web-renderer', '#masthead-ad', 'ytd-banner-promo-renderer',
        '.ytp-ad-overlay-container', '.ytp-ad-module'
      ]
    },
    cookies: {
      label: 'Cookie banners',
      desc: 'Consent popups and cookie walls',
      selectors: [
        '#onetrust-banner-sdk', '#onetrust-consent-sdk', '.onetrust-pc-dark-filter', '#CybotCookiebotDialog',
        '#CybotCookiebotDialogBodyUnderlay', '.cc-window', '.cc-banner', '#cookie-banner', '.cookie-banner',
        '#cookieConsent', '.cookie-consent', '.cookie-notice', '#cookie-notice', '#cookie-law-info-bar',
        '[id*="cookie-banner"]', '[class*="cookie-banner"]', '[id^="sp_message_container"]', '.truste_overlay',
        '#truste-consent-track', '.fc-consent-root', '#didomi-host', '#didomi-popup', '.qc-cmp2-container',
        '.evidon-banner', '#usercentrics-root', '.osano-cm-window', '.osano-cm-dialog', '#cmpbox', '#cmpbox2',
        '#gdpr-cookie-message', '.gdpr-banner', '#gdpr-banner', '#CookieBanner', '.CookieConsent',
        '.js-cookie-consent', '#cookiescript_injected', '#iubenda-cs-banner', '.iubenda-cs-container',
        '#cmp-container', '.cmp-container', '.fc-dialog-overlay', '.message-overlay'
      ],
      // when any of these exist the page is probably scroll-locked by a consent wall
      unlock: true
    },
    nags: {
      label: 'Newsletter & sign-in nags',
      desc: 'Newsletter popups, push prompts, "Sign in with Google" overlays',
      selectors: [
        '.newsletter-popup', '[class*="newsletter-modal"]', '[id*="newsletter-popup"]', '[class*="newsletter-popup"]',
        '[id*="onesignal"]', '[class*="onesignal"]', '#credential_picker_container',
        'iframe[src*="accounts.google.com/gsi"]', '#google-one-tap-popup-container', '.pushcrew-chrome-style-notification',
        '[class*="privy-popup"]', '[id^="privy-"]', '.mc-modal', '.mc-banner', '[class*="optinmonster"]',
        '.om-holder', '[id^="om-"][class*="optin"]', '.wisepops-root', '[id^="wisepops"]'
      ],
      unlock: true
    },
    chat: {
      label: 'Chat widgets',
      desc: 'Intercom, Drift, Zendesk, Crisp, Tawk and friends',
      selectors: [
        '#intercom-container', '.intercom-lightweight-app', '#intercom-frame', '.intercom-launcher',
        '#drift-widget-container', '#drift-frame-controller', '#drift-widget', '#hubspot-messages-iframe-container',
        '#crisp-chatbox', '.crisp-client', 'iframe#launcher[title*="essaging"]', '.zEWidget-launcher',
        '#ze-snippet', '#tidio-chat', '#tidio-chat-iframe', '#tawkchat-container', '.tawk-min-container',
        '#fc_frame', '#livechat-compact-container', '#livechat-full', '#gorgias-chat-container', '#chatra',
        'iframe[title="chat widget"]', 'iframe[title="Chat widget"]', '[id^="chat-widget"]', '.chat-widget'
      ]
    }
  };

  // Focus presets: platform specific de-cluttering. Off by default; per-preset toggle in the dashboard.
  const FOCUS_PRESETS = {
    'youtube-shorts': {
      label: 'YouTube: hide Shorts',
      hosts: ['youtube.com'],
      selectors: [
        'ytd-reel-shelf-renderer', 'ytd-rich-shelf-renderer[is-shorts]', 'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
        'ytd-guide-entry-renderer:has(a[title="Shorts"])', 'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
        'ytd-video-renderer:has(a[href^="/shorts/"])', 'grid-shelf-view-model:has(a[href^="/shorts/"])',
        'yt-tab-shape[tab-title="Shorts"]'
      ]
    },
    'youtube-recs': {
      label: 'YouTube: hide recommendations & comments',
      hosts: ['youtube.com'],
      selectors: ['ytd-browse[page-subtype="home"] #primary', '#related', '#secondary-inner ytd-watch-next-secondary-results-renderer', 'ytd-comments#comments', 'ytd-watch-flexy #chips-wrapper']
    },
    'reddit-clutter': {
      label: 'Reddit: hide sidebars & promoted posts',
      hosts: ['reddit.com'],
      selectors: ['#right-sidebar-container', 'shreddit-ad-post', '[data-testid="post-ad"]', 'faceplate-tracker:has(shreddit-ad-post)', 'reddit-pdp-right-rail', '.promotedlink', '.side']
    },
    'x-clutter': {
      label: 'X / Twitter: hide trends & suggestions',
      hosts: ['x.com', 'twitter.com'],
      selectors: ['[data-testid="sidebarColumn"] section[aria-labelledby]', '[aria-label="Timeline: Trending now"]', '[aria-label="Who to follow"]', '[data-testid="UserCell"]:has([data-testid$="-follow"])', '[data-testid="placementTracking"]']
    },
    'linkedin-clutter': {
      label: 'LinkedIn: hide news & promos',
      hosts: ['linkedin.com'],
      selectors: ['.ad-banner-container', '.news-module', '.scaffold-layout__aside', '[data-ad-banner]', '.feed-shared-update-v2--promoted']
    },
    'insta-fb-clutter': {
      label: 'Facebook: hide sponsored & reels',
      hosts: ['facebook.com'],
      selectors: ['[aria-label="Sponsored"]', 'a[href*="/ads/about"]', 'div[data-pagelet="RightRail"]', 'div[data-pagelet="FeedUnit"]:has(a[aria-label="Sponsored"])', 'div[data-pagelet="Reels"]']
    }
  };

  const DEFAULT_SETTINGS = {
    enabled: true,
    categories: { ads: true, trackers: true, cookies: true, nags: true, chat: true },
    focus: {},         // presetId -> true
    allowlist: [],     // hosts where DHBlocker is paused
    zaps: {},          // host -> [{ selector, added, label }]
    stats: { zapped: 0 }
  };

  // Which static DNR rulesets are on, given the category toggles.
  function enabledRulesets(cats) {
    const out = [];
    if (cats.ads) out.push('ads');
    if (cats.trackers) out.push('trackers');
    if (cats.chat || cats.nags) out.push('annoyances');
    return out;
  }

  function normalizeHost(h) {
    return (h || '').toLowerCase().replace(/^www\./, '');
  }

  function hostMatches(host, patterns) {
    host = normalizeHost(host);
    return patterns.some((p) => host === p || host.endsWith('.' + p));
  }

  function isAllowlisted(host, allowlist) {
    return hostMatches(host, allowlist || []);
  }

  function mergeSettings(stored) {
    const s = Object.assign({}, DEFAULT_SETTINGS, stored || {});
    s.categories = Object.assign({}, DEFAULT_SETTINGS.categories, (stored && stored.categories) || {});
    s.focus = Object.assign({}, (stored && stored.focus) || {});
    s.allowlist = (stored && stored.allowlist) || [];
    s.zaps = (stored && stored.zaps) || {};
    s.stats = Object.assign({}, DEFAULT_SETTINGS.stats, (stored && stored.stats) || {});
    return s;
  }

  root.DH = { CATEGORIES, FOCUS_PRESETS, DEFAULT_SETTINGS, enabledRulesets, normalizeHost, hostMatches, isAllowlisted, mergeSettings };
})(typeof self !== 'undefined' ? self : this);

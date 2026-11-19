// Generates rules/*.json (MV3 declarativeNetRequest static rulesets).
// Run: node scripts/build-rules.js
const fs = require('fs');
const path = require('path');

const ads = `doubleclick.net googlesyndication.com googleadservices.com googletagservices.com adservice.google.com
2mdn.net adnxs.com adsrvr.org advertising.com criteo.com criteo.net taboola.com outbrain.com outbrainimg.com
amazon-adsystem.com rubiconproject.com pubmatic.com openx.net casalemedia.com indexww.com smartadserver.com
adform.net moatads.com adsafeprotected.com doubleverify.com 33across.com sharethrough.com teads.tv media.net
bidswitch.net contextweb.com lijit.com sovrn.com yieldmo.com triplelift.com gumgum.com revcontent.com mgid.com
zemanta.com adroll.com bluekai.com exelator.com demdex.net krxd.net rlcdn.com mathtag.com serving-sys.com
adition.com popads.net exoclick.com exosrv.com juicyads.com clickadu.com adcash.com popcash.net onclickads.net
realsrv.com tsyndicate.com hilltopads.net adsterra.com highperformanceformat.com effectivegatecpm.com
trafficjunky.net trafficfactory.biz tapad.com adblade.com adsymptotic.com ad.gt adtechus.com yahoo-ads.com
advertising.yahoo.com ads.yahoo.com adkernel.com richaudience.com improvedigital.com connatix.com
primis.tech vidazoo.com spotxchange.com springserve.com freewheel.tv fwmrm.net innovid.com tremorhub.com
undertone.com inmobi.com mopub.com applovin.com unityads.unity3d.com adcolony.com chartboost.com
ads.linkedin.com ads.pinterest.com ads.reddit.com ads.tiktok.com bing.net.ads cpmstar.com propellerads.com
pushnami.com zedo.com nativeroll.tv content.ad dable.io ligatus.com plista.com adblockanalytics.com`;

const trackers = `google-analytics.com analytics.google.com stats.g.doubleclick.net hotjar.com hotjar.io
mixpanel.com mxpnl.com api.segment.io fullstory.com mouseflow.com crazyegg.com scorecardresearch.com
quantserve.com quantcount.com chartbeat.com chartbeat.net amplitude.com heapanalytics.com clarity.ms
analytics.tiktok.com ads-twitter.com analytics.twitter.com px.ads.linkedin.com snap.licdn.com sc-static.net
tr.snapchat.com bam.nr-data.net nr-data.net omtrdc.net 2o7.net everesttech.net branch.io app.link
adjust.com appsflyer.com kochava.com singular.net luckyorange.com luckyorange.net inspectlet.com
smartlook.com logrocket.com lr-ingest.io fathom.com statcounter.com yandex.ru/metrika mc.yandex.ru
pixel.facebook.com pingdom.net newrelic.com optimizely.com abtasty.com vwo.com visualwebsiteoptimizer.com
cdn.mouseflow.com tags.tiqcdn.com tealiumiq.com bounceexchange.com bouncex.net onetag-sys.com
liadm.com id5-sync.com pippio.com agkn.com eyeota.net semasio.net ml314.com permutive.com permutive.app
parsely.com marketo.net munchkin.marketo.net pardot.com hs-analytics.net hsadspixel.net hubspot.com/__ptq.gif
cloudflareinsights.com plausible.io/js/script`;

const annoyances = `widget.intercom.io js.intercomcdn.com js.driftt.com drift.com client.crisp.chat embed.tawk.to
tawk.to code.tidio.co static.zdassets.com ekr.zdassets.com wchat.freshchat.com cdn.livechatinc.com
config.gorgias.chat chatra.io cdn.onesignal.com onesignal.com pushwoosh.com pushengage.com
sendpulse.com/push webpushr.com izooto.com subscribers.com notix.io pushcrew.com cleverpush.com
cdn.privy.com widget.privy.com sumo.com sumome.com optinmonster.com omappapi.com mailmunch.co
popupsmart.com wisepops.com justuno.com getsitecontrol.com convertflow.com`;

const norm = (s) => s.split(/\s+/).filter(Boolean);
const domainsOnly = (list) => [...new Set(norm(list).filter((d) => !d.includes('/')))];
const pathRules = (list) => [...new Set(norm(list).filter((d) => d.includes('/')))];

const ALL_TYPES = ['script', 'image', 'stylesheet', 'xmlhttprequest', 'sub_frame', 'ping', 'media', 'font', 'websocket', 'other'];

function build(name, list, extra = []) {
  const rules = [];
  let id = 1;
  const domains = domainsOnly(list);
  // chunk to keep individual rules reasonably sized
  for (let i = 0; i < domains.length; i += 60) {
    rules.push({
      id: id++,
      priority: 1,
      action: { type: 'block' },
      condition: { requestDomains: domains.slice(i, i + 60), domainType: 'thirdParty', resourceTypes: ALL_TYPES },
    });
  }
  for (const p of pathRules(list)) {
    rules.push({
      id: id++,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: '||' + p, domainType: 'thirdParty', resourceTypes: ALL_TYPES },
    });
  }
  for (const filter of extra) {
    rules.push({
      id: id++,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: filter, domainType: 'thirdParty', resourceTypes: ALL_TYPES },
    });
  }
  fs.writeFileSync(path.join(__dirname, '..', 'rules', name + '.json'), JSON.stringify(rules, null, 2));
  console.log(name, rules.length, 'rules,', domains.length, 'domains');
}

build('ads', ads, ['||facebook.com/tr/', '/pagead/js/adsbygoogle.js', '/pagead/ads?', '||amazon.com/aax2/apstag.js']);
build('trackers', trackers, ['||facebook.com/tr?', '||google.com/ccm/collect', '||google.com/pagead/1p-user-list']);
build('annoyances', annoyances);

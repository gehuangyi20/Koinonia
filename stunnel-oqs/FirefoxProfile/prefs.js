user_pref("network.http.keep-alive.timeout", 1);
// user_pref("network.http.max-persistent-connections-per-proxy", 2);
// user_pref("network.http.max-persistent-connections-per-server", 2);
// user_pref("network.http.version", "1.0");
user_pref("network.http.proxy.version", "1.0");
user_pref("network.http.max-connections", 96);
user_pref("network.http.max-connections-per-server", 32);    
user_pref("network.http.max-persistent-connections-per-proxy", 24);    
user_pref("network.http.max-persistent-connections-per-server", 12);
user_pref("network.tcp.keepalive.enabled", false);
// user_pref("network.http.spdy.enabled", false);
user_pref("network.http.proxy.pipelining", false);

// disable OCSP related stuff to save traffic
user_pref("security.OCSP.enabled", 0);
user_pref("security.OCSP.require", false);
user_pref("security.OCSP.GET.enabled", false);
user_pref("security.ssl.enable_ocsp_must_staple", false);
user_pref("security.ssl.enable_ocsp_stapling", false);
user_pref("services.sync.prefs.sync.security.OCSP.enabled", false);
user_pref("services.sync.prefs.sync.security.OCSP.require", false);

// further disable auto-background-traffic
user_pref("extensions.blocklist.enabled", false);
user_pref("extensions.update.enabled", false);
user_pref("browser.safebrowsing.downloads.remote.enabled", false);
user_pref("network.prefetch-next", false);
user_pref("network.dns.disablePrefetch", true);
user_pref("network.http.speculative-parallel-limit", 0);
user_pref("browser.aboutHomeSnippets.updateUrl", "");
user_pref("browser.search.geoip.url", "");
user_pref("browser.selfsupport.url", "");
user_pref("extensions.getAddons.cache.enabled", false);
user_pref("network.captive-portal-service.enabled", false);
user_pref("browser.chrome.favicons", false);
user_pref("browser.chrome.site_icons", false);
user_pref("media.gmp-provider.enabled", false);
user_pref("media.gmp-manager.url", "");
user_pref("media.gmp-gmpopenh264.autoupdate", false);
user_pref("media.gmp-gmpopenh264.enabled", false);

user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.tabs.warnOnClose", false);

user_pref("browser.usedOnWindows10", true);

// disable the annoying first-run "What's New" and "Features" pages
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("startup.homepage_welcome_url.additional‌​", "about:blank");
user_pref("startup.homepage_welcome_url", "about:blank");

// disable more first-run options
user_pref("datareporting.healthreport.service.firstRun", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);

// disable the annoying prompt regarding data submission
user_pref("toolkit.telemetry.rejected", true);
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("datareporting.policy.dataSubmissionEnabled", false);

// proxy settings
user_pref("network.proxy.type", 1); // type 1 = manual setting

// http
user_pref("network.proxy.http", "127.0.0.1");
//user_pref("network.proxy.http_port", 18980);
user_pref("network.proxy.share_proxy_settings", true);
user_pref("network.proxy.no_proxies_on", "");

// https
// user_pref("network.proxy.ssl", "YOUR_PROXY_SERVER");
// user_pref("network.proxy.ssl_port", YOUR_PROXY_PORT);

// ftp
// user_pref("network.proxy.ftp", "YOUR_PROXY_SERVER");
// user_pref("network.proxy.ftp_port", YOUR_PROXY_PORT);

// socks
// user_pref("network.proxy.socks_version", 5);
// user_pref("network.proxy.socks", "localhost");
// user_pref("network.proxy.socks_port", 21052);

// set the page you want FF to open here
// user_pref("browser.startup.homepage", "http://www.example.com/");

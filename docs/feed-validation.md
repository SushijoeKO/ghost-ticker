# Feed validation

Checked 8 November 2026 from this environment. Each URL was fetched with the app's user-agent (`GhostTicker/1.0 (headline aggregator; +https://ghost-ticker.vercel.app/about)`), a 12 second timeout, and redirects followed. A feed was eligible only if the final response was HTTP 200, the body parsed as RSS or Atom, and at least one item had a title, a link, and a date within 7 days.

The running app still drops items older than 4 days (`MAX_AGE_MS` in `lib/feeds.ts`). Feeds with nothing inside that window were not added, even if something had been published in the last 7 days.

## Result

- Probed: 406 candidate URLs, plus recovered URLs for The Texas Tribune, The New Republic, All That's Interesting, and ProFootballTalk.
- Kept: **192** feeds.

| Category | Feeds |
| --- | ---: |
| top | 19 |
| politics | 42 |
| weird | 11 |
| us | 19 |
| world | 31 |
| tech | 20 |
| sports | 17 |
| entertainment | 16 |
| pop-culture | 17 |
| **total** | **192** |

Politics lean (approximate): Right 12, Lean Left 10, Left 8, Center 7, Lean Right 4, Libertarian 1.

## Clearance simulation

Same clustering code, items from the last 4 days, outlet = distinct source name.

| List | Stories | L1 (1) | L2 (2–3) | L3 (4–6) | L4 (7+) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Previous 71 feeds | 1,230 | 1,129 (91.79%) | 85 (6.91%) | 13 (1.06%) | 3 (0.24%) |
| Expanded list | 3,019 | 2,750 (91.09%) | 196 (6.49%) | 55 (1.82%) | 18 (0.60%) |

L4 did not become common. It moved from 0.24% of stories to 0.60%, far under a 10% share, so the cutoffs stay 1 / 2–3 / 4–6 / 7+. No scaled thresholds are proposed. That simulation still included All That's Interesting, which was removed afterwards for size; one odd-news feed does not change the L4 share.

Clustering was tightened in `lib/cluster.ts` after the larger set glued unrelated stories together: generic words such as "leaves thousands without" counted as rare and merged a Gaza flood with a Ukraine blackout; a single `arrest` in Los Angeles merged unrelated detentions; and a digest headline could union two groups that had already formed. Those links are rejected now. The existing unit test (Kraków shooting worded four ways, Kharkiv drones, a separate Christmas market) still passes. A few roundup headlines that literally contain two stories, such as a Straight Arrow News item that pairs a Mississippi ballot fight with the Trump arch ruling, can still sit with one of those stories.

## Fetch cycle

Production limits in `lib/feeds.ts`: 20 feeds in flight, 8 seconds per feed, 45 second budget for the whole sweep. A thrown error or a timeout returns no items for that feed and the sweep continues.

A live sweep of the kept feeds on 8 November 2026 finished in **2.1 seconds** of fetching, with every kept URL returning HTTP 200 and a parseable recent feed, none slower than 5 seconds. Clustering the parsed headlines took **0.6 seconds**. The sweep is about 3 seconds, against a 45 second cap and the ~60 second target. All That's Interesting was removed after that sweep: the feed is valid, but the body is 2.2MB and Next.js will not cache a response over 2MB, so every page logged a cache error and refetched it.

## Kept and dropped

| Feed | Category | URL | HTTP | Items ≤7d | Newest | Decision | Reason |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| CBS News | top | https://www.cbsnews.com/latest/rss/main | 200 | 30 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NBC News | top | https://feeds.nbcnews.com/nbcnews/public/news | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| ABC News | top | https://abcnews.go.com/abcnews/topstories | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NPR | top | https://feeds.npr.org/1001/rss.xml | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Fox News | top | https://moxie.foxnews.com/google-publisher/latest.xml | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| New York Post | top | https://nypost.com/news/feed/ | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| UPI | top | https://rss.upi.com/news/top_news.rss | 200 | 23 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NewsNation | top | https://www.newsnationnow.com/feed/ | 200 | 17 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Newsweek | top | https://www.newsweek.com/rss | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Axios | top | https://api.axios.com/feed/ | 200 | 100 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| PBS NewsHour | top | https://www.pbs.org/newshour/feeds/rss/headlines | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Christian Science Monitor | top | https://rss.csmonitor.com/feeds/csm | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Straight Arrow News | top | https://san.com/feed/ | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| TIME | top | https://time.com/feed/ | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| CNBC | top | https://www.cnbc.com/id/100003114/device/rss/rss.html | 200 | 30 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Semafor | top | https://www.semafor.com/rss.xml | 200 | 177 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Just the News | top | https://justthenews.com/rss.xml | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Daily Mail | top | https://www.dailymail.com/ushome/index.rss | 200 | 57 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Business Insider | top | https://www.businessinsider.com/rss | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Politico | politics | https://rss.politico.com/politics-news.xml | 200 | 23 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Washington Post | politics | https://feeds.washingtonpost.com/rss/politics | 200 | 34 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Guardian US | politics | https://www.theguardian.com/us-news/us-politics/rss | 200 | 17 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| HuffPost | politics | https://www.huffpost.com/section/politics/feed | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NPR Politics | politics | https://feeds.npr.org/1014/rss.xml | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| CBS News Politics | politics | https://www.cbsnews.com/latest/rss/politics | 200 | 30 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Hill | politics | https://thehill.com/homenews/feed/ | 200 | 15 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| RealClearPolitics | politics | https://www.realclearpolitics.com/index.xml | 200 | 33 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Reason | politics | https://reason.com/feed/ | 200 | 45 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Fox News Politics | politics | https://moxie.foxnews.com/google-publisher/politics.xml | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Daily Caller | politics | https://dailycaller.com/feed/ | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Washington Examiner | politics | https://www.washingtonexaminer.com/feed | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| National Review | politics | https://www.nationalreview.com/feed/ | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Washington Times | politics | https://www.washingtontimes.com/rss/headlines/news/politics/ | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| New York Post Politics | politics | https://nypost.com/politics/feed/ | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Mother Jones | politics | https://www.motherjones.com/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Nation | politics | https://www.thenation.com/feed/?post_type=article | 200 | 39 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Intercept | politics | https://theintercept.com/feed/?rss | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Vox | politics | https://www.vox.com/rss/politics/index.xml | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Slate | politics | https://slate.com/feeds/news-and-politics.rss | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| MSNBC | politics | https://www.msnbc.com/feed | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NBC News Politics | politics | https://feeds.nbcnews.com/nbcnews/public/politics | 200 | 24 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Talking Points Memo | politics | https://talkingpointsmemo.com/feed | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| ProPublica | politics | https://www.propublica.org/feeds/propublica/main | 200 | 15 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The 19th | politics | https://19thnews.org/feed/ | 200 | 20 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Atlantic | politics | https://www.theatlantic.com/feed/channel/politics/ | 200 | 22 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The New Republic | politics | https://newrepublic.com/rss.xml | 200 | 21 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| PBS NewsHour | politics | https://www.pbs.org/newshour/feeds/rss/politics | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Christian Science Monitor | politics | https://rss.csmonitor.com/feeds/politics | 200 | 11 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Roll Call | politics | https://rollcall.com/feed/ | 200 | 10 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Dispatch | politics | https://thedispatch.com/feed | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Bulwark | politics | https://www.thebulwark.com/feed | 200 | 19 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Free Press | politics | https://www.thefp.com/feed | 200 | 20 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The American Spectator | politics | https://spectator.org/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| UnHerd | politics | https://unherd.com/feed/ | 200 | 24 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Federalist | politics | https://thefederalist.com/feed/ | 200 | 20 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Washington Free Beacon | politics | https://freebeacon.com/feed/ | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Daily Wire | politics | https://www.dailywire.com/feeds/rss.xml | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Breitbart | politics | https://feeds.feedburner.com/breitbart | 200 | 48 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Daily Signal | politics | https://www.dailysignal.com/feed | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Townhall | politics | https://townhall.com/tipsheet/feed | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The American Conservative | politics | https://www.theamericanconservative.com/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| UPI Odd News | weird | https://rss.upi.com/news/odd_news.rss | 200 | 25 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NY Post Weird But True | weird | https://nypost.com/weird-but-true/feed/ | 200 | 2 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Mirror Weird News | weird | https://www.mirror.co.uk/news/weird-news/?service=rss | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Metro Weird | weird | https://metro.co.uk/news/weird/feed/ | 200 | 6 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Daily Star Weird News | weird | https://www.dailystar.co.uk/news/weird-news/?service=rss | 200 | 22 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NDTV Offbeat | weird | https://feeds.feedburner.com/ndtvnews-offbeat-news | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Boing Boing | weird | https://boingboing.net/feed | 200 | 30 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Atlas Obscura | weird | https://www.atlasobscura.com/feeds/latest | 200 | 13 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Mental Floss | weird | https://www.mentalfloss.com/feed | 200 | 43 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| SoraNews24 | weird | https://soranews24.com/feed/ | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| indy100 | weird | https://www.indy100.com/rss | 200 | 18 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| All That's Interesting | weird | https://allthatsinteresting.com/feed | 200 | 12 | 2026-11-07 | dropped | Valid feed, but the body is 2.2MB of article HTML. Next.js will not cache a response over 2MB, so every sweep logged an error and downloaded it again. |
| Fox News U.S. | us | https://moxie.foxnews.com/google-publisher/us.xml | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Guardian US | us | https://www.theguardian.com/us-news/rss | 200 | 33 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| BBC News US & Canada | us | https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml | 200 | 32 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| ABC News | us | https://abcnews.go.com/abcnews/usheadlines | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| CBS News | us | https://www.cbsnews.com/latest/rss/us | 200 | 30 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NPR | us | https://feeds.npr.org/1003/rss.xml | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| PBS NewsHour | us | https://www.pbs.org/newshour/feeds/rss/nation | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Los Angeles Times | us | https://www.latimes.com/world-nation/rss2.0.xml | 200 | 29 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Texas Tribune | us | https://www.texastribune.org/feed | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| CalMatters | us | https://calmatters.org/feed/ | 200 | 10 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| KFF Health News | us | https://kffhealthnews.org/feed/ | 200 | 10 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| STAT | us | https://www.statnews.com/feed/ | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Marshall Project | us | https://www.themarshallproject.org/rss/recent.rss | 200 | 4 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Inside Climate News | us | https://insideclimatenews.org/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Task & Purpose | us | https://taskandpurpose.com/feed/ | 200 | 15 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Defense One | us | https://www.defenseone.com/rss/all/ | 200 | 15 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Gothamist | us | https://gothamist.com/feed | 200 | 40 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| THE CITY | us | https://www.thecity.nyc/feed | 200 | 10 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Sky News | us | https://feeds.skynews.com/feeds/rss/us.xml | 200 | 8 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| BBC News World | world | https://feeds.bbci.co.uk/news/world/rss.xml | 200 | 28 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Al Jazeera | world | https://www.aljazeera.com/xml/rss/all.xml | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| DW | world | https://rss.dw.com/rdf/rss-en-all | 200 | 59 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| France 24 | world | https://www.france24.com/en/rss | 200 | 24 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Guardian World | world | https://www.theguardian.com/world/rss | 200 | 43 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Fox News World | world | https://moxie.foxnews.com/google-publisher/world.xml | 200 | 18 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Sky News World | world | https://feeds.skynews.com/feeds/rss/world.xml | 200 | 6 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NPR | world | https://feeds.npr.org/1004/rss.xml | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| ABC News | world | https://abcnews.go.com/abcnews/internationalheadlines | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NBC News | world | https://feeds.nbcnews.com/nbcnews/public/world | 200 | 17 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| PBS NewsHour | world | https://www.pbs.org/newshour/feeds/rss/world | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Independent | world | https://www.independent.co.uk/news/world/rss | 200 | 37 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Euronews | world | https://www.euronews.com/rss?format=mrss&level=theme&name=news | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Politico Europe | world | https://www.politico.eu/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| RFI | world | https://www.rfi.fr/en/rss | 200 | 21 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Le Monde | world | https://www.lemonde.fr/en/rss/une.xml | 200 | 14 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| El País | world | https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada | 200 | 24 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Global News | world | https://globalnews.ca/world/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| ABC News Australia | world | https://www.abc.net.au/news/feed/51120/rss.xml | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| South China Morning Post | world | https://www.scmp.com/rss/91/feed | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| CNA | world | https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Japan Times | world | https://www.japantimes.co.jp/feed/ | 200 | 30 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Hong Kong Free Press | world | https://hongkongfp.com/feed/ | 200 | 30 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Hindu | world | https://www.thehindu.com/news/international/feeder/default.rss | 200 | 60 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Jerusalem Post | world | https://www.jpost.com/rss/rssfeedsfrontpage.aspx | 200 | 21 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Arab News | world | https://www.arabnews.com/rss.xml | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Middle East Eye | world | https://www.middleeasteye.net/rss | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Meduza | world | https://meduza.io/rss/en/all | 200 | 30 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Moscow Times | world | https://www.themoscowtimes.com/rss/news | 200 | 47 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Africanews | world | https://www.africanews.com/feed/rss | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Daily Maverick | world | https://www.dailymaverick.co.za/dmrss/ | 200 | 51 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Ars Technica | tech | https://feeds.arstechnica.com/arstechnica/index | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Verge | tech | https://www.theverge.com/rss/index.xml | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| TechCrunch | tech | https://techcrunch.com/feed/ | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| WIRED | tech | https://www.wired.com/feed/rss | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Fox News Tech | tech | https://moxie.foxnews.com/google-publisher/tech.xml | 200 | 15 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Register | tech | https://www.theregister.com/headlines.atom | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| 404 Media | tech | https://www.404media.co/rss/ | 200 | 15 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| MIT Technology Review | tech | https://www.technologyreview.com/feed/ | 200 | 10 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Quanta Magazine | tech | https://api.quantamagazine.org/feed/ | 200 | 3 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NASA | tech | https://www.nasa.gov/rss/dyn/breaking_news.rss | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Scientific American | tech | https://www.scientificamerican.com/platform/syndication/rss/ | 200 | 35 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| CNET | tech | https://www.cnet.com/rss/news/ | 200 | 19 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Engadget | tech | https://www.engadget.com/rss.xml | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| BleepingComputer | tech | https://www.bleepingcomputer.com/feed/ | 200 | 15 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Record | tech | https://therecord.media/feed | 200 | 5 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Space.com | tech | https://www.space.com/feeds/all | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| BBC News | tech | https://feeds.bbci.co.uk/news/science_and_environment/rss.xml | 200 | 26 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Guardian | tech | https://www.theguardian.com/science/rss | 200 | 16 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NPR | tech | https://feeds.npr.org/1007/rss.xml | 200 | 2 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| New Scientist | tech | https://www.newscientist.com/feed/home/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| ESPN | sports | https://www.espn.com/espn/rss/news | 200 | 27 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| CBS Sports | sports | https://www.cbssports.com/rss/headlines/ | 200 | 36 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Yahoo Sports | sports | https://sports.yahoo.com/rss/ | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Fox News Sports | sports | https://moxie.foxnews.com/google-publisher/sports.xml | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| BBC Sport | sports | https://feeds.bbci.co.uk/sport/rss.xml | 200 | 58 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Sky Sports | sports | https://www.skysports.com/rss/12040 | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Guardian Sport | sports | https://www.theguardian.com/uk/sport/rss | 200 | 41 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Sporting News | sports | https://www.sportingnews.com/us/rss | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Front Office Sports | sports | https://frontofficesports.com/feed/ | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Just Women's Sports | sports | https://justwomenssports.com/feed/ | 200 | 10 | 2026-11-06 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| MLB Trade Rumors | sports | https://www.mlbtraderumors.com/feed | 200 | 15 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| ProFootballTalk | sports | https://profootballtalk.nbcsports.com/feed/ | 200 | 30 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| talkSPORT | sports | https://talksport.com/feed/ | 200 | 100 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Autosport | sports | https://www.autosport.com/rss/feed/all | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Cyclingnews | sports | https://www.cyclingnews.com/rss/ | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Andscape | sports | https://andscape.com/feed | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Defector | sports | https://defector.com/feed | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Variety | entertainment | https://variety.com/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Hollywood Reporter | entertainment | https://www.hollywoodreporter.com/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Deadline | entertainment | https://deadline.com/feed/ | 200 | 12 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Billboard | entertainment | https://www.billboard.com/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Rolling Stone | entertainment | https://www.rollingstone.com/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Fox News Entertainment | entertainment | https://moxie.foxnews.com/google-publisher/entertainment.xml | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| BBC Entertainment | entertainment | https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml | 200 | 21 | 2026-11-07 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| IndieWire | entertainment | https://www.indiewire.com/feed/ | 200 | 12 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| TheWrap | entertainment | https://www.thewrap.com/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Vanity Fair | entertainment | https://www.vanityfair.com/feed/rss | 200 | 30 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| NME | entertainment | https://www.nme.com/feed | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| TVLine | entertainment | https://tvline.com/feed/ | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Consequence | entertainment | https://consequence.net/feed/ | 200 | 15 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Stereogum | entertainment | https://www.stereogum.com/feed/ | 200 | 40 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Gold Derby | entertainment | https://www.goldderby.com/feed/ | 200 | 12 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The Guardian | entertainment | https://www.theguardian.com/film/rss | 200 | 15 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Vulture | pop-culture | https://feeds.feedburner.com/nymag/vulture | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| The A.V. Club | pop-culture | https://www.avclub.com/rss | 200 | 54 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Polygon | pop-culture | https://www.polygon.com/rss/index.xml | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| IGN | pop-culture | https://feeds.feedburner.com/ign/all | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Pitchfork | pop-culture | https://pitchfork.com/feed/feed-news/rss | 200 | 29 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Page Six | pop-culture | https://pagesix.com/feed/ | 200 | 10 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| TMZ | pop-culture | https://www.tmz.com/rss.xml | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| E! Online | pop-culture | https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml | 200 | 30 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Kotaku | pop-culture | https://kotaku.com/rss | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| PC Gamer | pop-culture | https://www.pcgamer.com/rss/ | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| GameSpot | pop-culture | https://www.gamespot.com/feeds/mashup/ | 200 | 13 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Eurogamer | pop-culture | https://www.eurogamer.net/feed | 200 | 62 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Nintendo Life | pop-culture | https://www.nintendolife.com/feeds/latest | 200 | 25 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Anime News Network | pop-culture | https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us | 200 | 139 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| ComicBook.com | pop-culture | https://comicbook.com/feed/ | 200 | 50 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Hypebeast | pop-culture | https://hypebeast.com/feed | 200 | 20 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Soompi | pop-culture | https://www.soompi.com/feed | 200 | 60 | 2026-11-08 | kept | Public feed, HTTP 200, parseable, items within 7 days. |
| Sky News Strange | weird | https://feeds.skynews.com/feeds/rss/strange.xml | 200 | 0 | 2026-10-30 | dropped | Existing feed is stale: newest item 2026-10-30, outside the 7-day window. |
| The Athletic | sports | https://www.nytimes.com/athletic/rss/news/ | 200 | 100 | 2026-11-08 | dropped | NYT RSS terms allow personal news-reader or non-commercial blog use only and prohibit commercial redistribution without written permission. The Athletic feed is on nytimes.com. |
| The New York Times | top | https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml | 200 | 13 | 2026-11-08 | dropped | NYT RSS terms: personal use in a news reader or a non-commercial blog only. Commercial redistribution needs written permission. |
| The Wall Street Journal | world | https://feeds.content.dowjones.io/public/rss/RSSWorldNews | 200 | 51 | 2026-11-08 | dropped | WSJ RSS terms explicitly forbid publishing, aggregating, or distributing the feed, including for advertising revenue. |
| Bloomberg | top | https://www.bloomberg.com/feeds/news.rss | 200 | 20 | 2026-11-08 | dropped | Bloomberg terms forbid distributing the service over a computer network or building a database from it without written consent. |
| CNN | top | http://rss.cnn.com/rss/cnn_topstories.rss | 200 | 0 | 2023-05-01 | dropped | CNN's public RSS is stale (newest item 2023-05-01). Older CNN terms also limit feeds to non-commercial use. |
| Reuters | top | http://feeds.reuters.com/reuters/topNews | 0 | 0 | — | dropped | Reuters ended public RSS in 2020 (connection failed). Terms also forbid using Reuters content, including RSS, in a competing or commercial product. Google News proxies are not Reuters' own feed. |
| Associated Press | top | https://rsshub.app/apnews/topics/apf-topnews | 403 | 0 | — | dropped | No official public AP RSS (HTTP 403). Historical AP terms limited feeds to personal, non-commercial use and forbade third-party redistribution. |
| The Economist | world | https://www.economist.com/international/rss.xml | 200 | 2 | 2026-11-05 | dropped | Economist terms restrict content to personal, non-commercial use and forbid reproducing it on another website. |
| Financial Times | world | https://www.ft.com/rss/home | 200 | 9 | 2026-11-08 | dropped | FT is paywalled and its terms restrict systematic redistribution. |
| The Onion | weird | https://theonion.com/feed | 200 | 12 | 2026-11-06 | dropped | Satire. Fictional headlines would be mixed into the wire as news. |
| The Babylon Bee | politics | https://babylonbee.com/feed | 200 | 3 | 2026-11-07 | dropped | Satire. Fictional headlines would be mixed into the wire as news. |
| RT | world | https://www.rt.com/rss/news/ | 200 | 99 | 2026-11-08 | dropped | State broadcaster whose output is primarily propaganda; not added. |
| USA Today | top | https://www.usatoday.com/news/rss/ | 404 | 0 | — | dropped | USA Today RSS URLs now return 404 or an HTML page, not a feed. |
| Scripps News | top | https://www.scrippsnews.com/stories.rss | 200 | 0 | — | dropped | Scripps News / Newsy RSS answered with an empty channel. |
| Newsmax | top | https://www.newsmax.com/rss/Newsfront/1/ | 0 | 0 | — | dropped | Newsmax RSS timed out (12s) on both Newsfront URLs. |
| The Week | top | https://theweek.com/feeds/all.rss | 404 | 0 | — | dropped | HTTP 404 |
| USA Today | us | https://rssfeeds.usatoday.com/UsatodaycomNation-TopStories | 200 | 0 | — | dropped | USA Today nation feed returned no items. |
| The Texas Tribune (alternate) | us | https://www.texastribune.org/feeds/feed/ | 200 | 0 | — | dropped | no items with title and link |
| Block Club Chicago | us | https://blockclubchicago.org/feed/ | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Military Times | us | https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml | 200 | 10 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Stars and Stripes | us | https://www.stripes.com/rss | 404 | 0 | — | dropped | HTTP 404 |
| Defense News | us | https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml | 200 | 10 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Breaking Defense | us | https://breakingdefense.com/feed/ | 200 | 15 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| USNI News | us | https://news.usni.org/feed | 200 | 19 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Chalkbeat | us | https://www.chalkbeat.org/feed/ | 404 | 0 | — | dropped | HTTP 404 |
| Spotlight PA | us | https://www.spotlightpa.org/feeds/all/ | 404 | 0 | — | dropped | HTTP 404 |
| Mississippi Today | us | https://mississippitoday.org/feed/ | 200 | 12 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Bridge Michigan | us | https://www.bridgemi.com/feed | 200 | 10 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Nevada Independent | us | https://thenevadaindependent.com/feed | 200 | 26 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Democracy Now! | politics | https://www.democracynow.org/democracynow.rss | 200 | 19 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Salon | politics | https://www.salon.com/feed/ | 200 | 27 | 2026-11-05 | dropped | Lead item is 'Goodbye from Salon'; the outlet is closing. |
| Jacobin | politics | https://jacobin.com/feed | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Common Dreams | politics | https://www.commondreams.org/rss.xml | 200 | 14 | 2026-11-06 | dropped | Feed is advocacy press releases (Public Citizen, ACLU), not reported news. |
| Daily Kos | politics | https://www.dailykos.com/blogs/main.rss | 200 | 8 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Raw Story | politics | https://www.rawstory.com/feed/ | 200 | 30 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The New Republic (alternate) | politics | https://newrepublic.com/rss | 404 | 0 | — | dropped | HTTP 404 |
| The New Republic (alternate) | politics | https://newrepublic.com/feed | 404 | 0 | — | dropped | HTTP 404 |
| The American Prospect | politics | https://prospect.org/feed/ | 200 | 10 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Axios | politics | https://api.axios.com/feed/politics | 404 | 0 | — | dropped | HTTP 404 |
| USA Today | politics | https://rssfeeds.usatoday.com/UsatodaycomWashington-TopStories | 200 | 0 | — | dropped | USA Today politics feed returned no items. |
| PolitiFact | politics | https://www.politifact.com/feeds/stories/ | 404 | 0 | — | dropped | HTTP 404 |
| FactCheck.org | politics | https://www.factcheck.org/feed/ | 200 | 4 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| C-SPAN | politics | https://www.c-span.org/rss/ | 403 | 0 | — | dropped | HTTP 403 |
| NOTUS | politics | https://www.notus.org/feed | 404 | 0 | — | dropped | HTTP 404 |
| Punchbowl News | politics | https://punchbowl.news/feed/ | 200 | 10 | 2026-11-08 | dropped | Items are paid-newsletter lookaheads ('paid … Vault Sunday Lookahead'), not public articles. |
| The Blaze | politics | https://www.theblaze.com/feeds/feed.rss | 200 | 30 | 2026-11-08 | dropped | Feed is devotional and culture-war commentary, not a news report. |
| Newsmax | politics | https://www.newsmax.com/rss/Politics/16/ | 0 | 0 | — | dropped | Newsmax politics RSS timed out. |
| Hot Air | politics | https://hotair.com/feed | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| RedState | politics | https://redstate.com/feed | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| PJ Media | politics | https://pjmedia.com/feed | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Epoch Times | politics | https://feed.theepochtimes.com/us/index.rss | 404 | 0 | — | dropped | HTTP 404 |
| The New York Sun | politics | https://www.nysun.com/feed | 429 | 0 | — | dropped | HTTP 429 |
| The Spectator (alternate) | politics | https://thespectator.com/feed/ | 404 | 0 | — | dropped | HTTP 404 |
| Quillette | politics | https://quillette.com/feed | 404 | 0 | — | dropped | HTTP 404 |
| Cato Institute | politics | https://www.cato.org/rss/multimedia | 403 | 0 | — | dropped | HTTP 403 |
| FEE | politics | https://fee.org/feed | 200 | 0 | — | dropped | no items with title and link |
| The Hill | politics | https://thehill.com/news/feed/ | 200 | 15 | 2026-11-08 | dropped | Duplicate of The Hill's main politics feed. |
| CBS News | world | https://www.cbsnews.com/latest/rss/world | 200 | 30 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Christian Science Monitor | world | https://rss.csmonitor.com/feeds/world | 200 | 12 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| TIME | world | https://time.com/section/world/feed/ | 200 | 0 | — | dropped | no items with title and link |
| Euractiv | world | https://www.euractiv.com/feed/ | 200 | 100 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Der Spiegel | world | https://www.spiegel.de/international/index.rss | 200 | 1 | 2026-11-03 | dropped | Only one item inside 7 days and none inside the app's 4-day display window. |
| SWI swissinfo.ch | world | https://www.swissinfo.ch/service/eng/rssxml/latest-news/rss | 200 | 30 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| RTÉ | world | https://www.rte.ie/feeds/rss/?index=/news/ | 200 | 60 | 2026-11-08 | dropped | RTÉ's main feed is Irish domestic news (road crashes, pay talks), which would fill the world column. |
| The Journal | world | https://www.thejournal.ie/feed/ | 200 | 38 | 2026-11-08 | dropped | The Journal.ie feed is Irish local news and quizzes. |
| CBC | world | https://www.cbc.ca/cmlink/rss-world | 0 | 0 | — | dropped | CBC world RSS timed out. |
| CBC | world | https://rss.cbc.ca/lineup/topstories.xml | 0 | 0 | — | dropped | CBC top-stories RSS timed out. |
| CTV News | world | https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009 | 404 | 0 | — | dropped | HTTP 404 |
| SBS News | world | https://www.sbs.com.au/news/feed | 200 | 0 | 2026-08-26 | dropped | newest item older than 7 days |
| RNZ | world | https://www.rnz.co.nz/rss/world.xml | 200 | 4 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Sydney Morning Herald | world | https://www.smh.com.au/rss/world.xml | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| news.com.au | world | https://www.news.com.au/feed | 403 | 0 | — | dropped | HTTP 403 |
| The Straits Times | world | https://www.straitstimes.com/news/world/rss.xml | 200 | 50 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| NHK World | world | https://www3.nhk.or.jp/nhkworld/rss/news/cat0.xml | 404 | 0 | — | dropped | No working English NHK World RSS. The Japanese NHK feed was not added. |
| The Korea Herald | world | http://www.koreaherald.com/common/rss_xml.php?ct=102 | 200 | 0 | — | dropped | no items with title and link |
| Taipei Times | world | https://www.taipeitimes.com/xml/index.rss | 200 | 49 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Rappler | world | https://www.rappler.com/feed/ | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Diplomat | world | https://thediplomat.com/feed/ | 200 | 68 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Nikkei Asia | world | https://asia.nikkei.com/rss/feed/nar | 200 | 0 | — | dropped | no parseable item dates |
| Times of Israel | world | https://www.timesofisrael.com/feed/ | 403 | 0 | — | dropped | Times of Israel returned HTTP 403 to the aggregator user-agent. |
| Al Arabiya English | world | https://english.alarabiya.net/tools/rss | 403 | 0 | — | dropped | Al Arabiya English returned HTTP 403. |
| Al-Monitor | world | https://www.al-monitor.com/rss | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The National | world | https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml | 200 | 80 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| TRT World | world | https://www.trtworld.com/rss | 404 | 0 | — | dropped | HTTP 404 |
| Anadolu Agency | world | https://www.aa.com.tr/en/rss/default?cat=world | 200 | 30 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Kyiv Independent | world | https://kyivindependent.com/feed/ | 404 | 0 | — | dropped | Kyiv Independent feed URLs returned HTTP 404. |
| Balkan Insight | world | https://balkaninsight.com/feed/ | 200 | 35 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Bellingcat | world | https://www.bellingcat.com/feed/ | 200 | 2 | 2026-11-05 | dropped | Only one item inside the 4-day display window. Too thin for a standing desk. |
| OCCRP | world | https://www.occrp.org/en/feed | 200 | 12 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| ICIJ | world | https://www.icij.org/feed/ | 200 | 3 | 2026-11-04 | dropped | Alive, but no item inside the app's 4-day display window, so the sweep would add zero headlines. |
| Rest of World | world | https://restofworld.org/feed/latest | 200 | 2 | 2026-11-05 | dropped | Only one item inside the 4-day display window. |
| Mail & Guardian | world | https://mg.co.za/feed/ | 404 | 0 | — | dropped | HTTP 404 |
| News24 | world | https://www.news24.com/feeds/rss/news24/SouthAfrica | 403 | 0 | — | dropped | HTTP 403 |
| Premium Times | world | https://www.premiumtimesng.com/feed | 200 | 15 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Mexico News Daily | world | https://mexiconewsdaily.com/feed/ | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| MercoPress | world | https://en.mercopress.com/rss | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Buenos Aires Times | world | https://www.batimes.com.ar/feed | 200 | 43 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Buenos Aires Herald | world | https://buenosairesherald.com/feed | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Times of India | world | https://timesofindia.indiatimes.com/rssfeeds/296589292.cms | 200 | 20 | 2026-11-08 | dropped | The international section feed returned real-estate listings and celebrity items, not world news. |
| UN News | world | https://news.un.org/feed/subscribe/en/news/all/rss.xml | 200 | 27 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The National Interest | world | https://nationalinterest.org/feed | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| France 24 | world | https://www.france24.com/en/africa/rss | 200 | 22 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| BBC News | world | https://feeds.bbci.co.uk/news/uk/rss.xml | 200 | 26 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Guardian | world | https://www.theguardian.com/uk-news/rss | 200 | 43 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| IEEE Spectrum | tech | https://spectrum.ieee.org/feeds/feed.rss | 200 | 5 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Gizmodo | tech | https://gizmodo.com/feed | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Krebs on Security | tech | https://krebsonsecurity.com/feed/ | 200 | 2 | 2026-11-05 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Hacker News | tech | https://feeds.feedburner.com/TheHackersNews | 200 | 50 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| CyberScoop | tech | https://cyberscoop.com/feed/ | 200 | 10 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Markup | tech | https://themarkup.org/feeds/rss.xml | 200 | 0 | 2026-10-15 | dropped | The Markup's newest item is 2026-10-15. |
| Platformer | tech | https://www.platformer.news/feed | 200 | 2 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Live Science | tech | https://www.livescience.com/feeds/all | 200 | 39 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| ScienceAlert | tech | https://www.sciencealert.com/feed | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Phys.org | tech | https://phys.org/rss-feed/ | 200 | 30 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| IFLScience | tech | https://www.iflscience.com/feed | 403 | 0 | — | dropped | HTTP 403 |
| Nature | tech | https://www.nature.com/nature.rss | 200 | 74 | 2026-11-06 | dropped | Nature's RSS is journal highlights and book briefs, not a news desk. |
| Science | tech | https://www.science.org/rss/news_current.xml | 200 | 10 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Conversation | tech | https://theconversation.com/us/articles.atom | 200 | 46 | 2026-11-06 | dropped | The Conversation's main feed is essays on every subject. Filing it under tech would put politics and religion in the science column. |
| Smithsonian Magazine | tech | https://www.smithsonianmag.com/rss/latest_articles/ | 200 | 10 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| VentureBeat | tech | https://venturebeat.com/feed/ | 429 | 0 | — | dropped | HTTP 429 |
| ZDNET | tech | https://www.zdnet.com/news/rss.xml | 200 | 25 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Fast Company | tech | https://www.fastcompany.com/latest/rss | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Tom's Hardware | tech | https://www.tomshardware.com/feeds/all | 200 | 50 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| MacRumors | tech | https://feeds.macrumors.com/MacRumors-All | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Android Authority | tech | https://www.androidauthority.com/feed/ | 200 | 80 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| 9to5Mac | tech | https://9to5mac.com/feed/ | 200 | 100 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Schneier on Security | tech | https://www.schneier.com/feed/atom/ | 200 | 4 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Futurism | tech | https://futurism.com/feed | 200 | 62 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Ars Technica | tech | https://feeds.arstechnica.com/arstechnica/science-policy | 404 | 0 | — | dropped | HTTP 404 |
| HuffPost | weird | https://www.huffpost.com/section/weird-news/feed | 200 | 0 | — | dropped | HuffPost weird-news feed returned no items. |
| Oddity Central | weird | https://www.odditycentral.com/feed | 200 | 0 | 2026-09-18 | dropped | Oddity Central's newest item is 2026-09-18. |
| LADbible | weird | https://www.ladbible.com/feed | 404 | 0 | — | dropped | HTTP 404 |
| UNILAD | weird | https://www.unilad.com/feed | 404 | 0 | — | dropped | HTTP 404 |
| indy100 (alternate) | weird | https://www.indy100.com/feed | 404 | 0 | — | dropped | HTTP 404 |
| Mental Floss (alternate) | weird | https://www.mentalfloss.com/rss | 404 | 0 | — | dropped | HTTP 404 |
| VICE | weird | https://www.vice.com/en/rss | 200 | 10 | 2026-11-08 | dropped | Feed is celebrity and music, not odd news, so it does not belong on the weird desk. |
| Global News | weird | https://globalnews.ca/odd/feed/ | 404 | 0 | — | dropped | Global News 'weird' tag feed is stale (newest item 2024-12-28). |
| news.com.au | weird | https://www.news.com.au/lifestyle/rss | 200 | 0 | — | dropped | empty body |
| Daily Mail | weird | https://www.dailymail.co.uk/news/weird-news/index.rss | 404 | 0 | — | dropped | HTTP 404 |
| CBC | weird | https://www.cbc.ca/webfeed/rss/rss-offbeat | 0 | 0 | — | dropped | CBC offbeat RSS timed out. |
| Bleacher Report | sports | https://bleacherreport.com/articles/feed | 404 | 0 | — | dropped | HTTP 404 |
| SB Nation | sports | https://www.sbnation.com/rss/current | 404 | 0 | — | dropped | HTTP 404 |
| The Ringer | sports | https://www.theringer.com/rss/index.xml | 404 | 0 | — | dropped | HTTP 404 |
| Awful Announcing | sports | https://awfulannouncing.com/feed | 200 | 15 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Sports Illustrated | sports | https://www.si.com/rss | 404 | 0 | — | dropped | HTTP 404 |
| NBC Sports | sports | https://sports.yahoo.com/nfl/rss/ | 200 | 50 | 2026-11-08 | dropped | NBC Sports has no working RSS. The fallback URL was a Yahoo NFL feed, which would double-count Yahoo Sports. ProFootballTalk is kept instead. |
| ProFootballTalk (alternate) | sports | https://www.nbcsports.com/nfl/profootballtalk/feed | 404 | 0 | — | dropped | HTTP 404 |
| Goal | sports | https://www.goal.com/feeds/en/news | 404 | 0 | — | dropped | HTTP 404 |
| The Hockey News | sports | https://thehockeynews.com/feed | 200 | 50 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| OutKick | sports | https://www.outkick.com/feed | 404 | 0 | — | dropped | HTTP 404 |
| Deadspin | sports | https://deadspin.com/feed | 404 | 0 | — | dropped | HTTP 404 |
| USA Today | sports | https://rssfeeds.usatoday.com/usatodaycomsports-topstories | 200 | 0 | — | dropped | USA Today sports feed returned no items. |
| theScore | sports | https://www.thescore.com/news.rss | 404 | 0 | — | dropped | HTTP 404 |
| Yardbarker | sports | https://www.yardbarker.com/rss/rumors | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| RaceFans | sports | https://www.racefans.net/feed/ | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Golf.com | sports | https://golf.com/feed/ | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Fox Sports | sports | https://api.foxsports.com/v2/content/optimized?apikey=jE7yBJVRNAwdDesMgTzTXUUSx1It41Fq | 403 | 0 | — | dropped | HTTP 403 |
| The Guardian | sports | https://www.theguardian.com/football/rss | 200 | 39 | 2026-11-08 | dropped | Duplicate of The Guardian Sport. |
| BBC Sport | sports | https://feeds.bbci.co.uk/sport/football/rss.xml | 200 | 49 | 2026-11-08 | dropped | Duplicate of BBC Sport. |
| ESPN | sports | https://www.espn.com/espn/rss/nfl/news | 200 | 16 | 2026-11-08 | dropped | Duplicate of the ESPN desk already kept. Same outlet name would mostly repeat headlines. |
| Entertainment Weekly | entertainment | https://ew.com/feed/ | 402 | 0 | — | dropped | HTTP 402 |
| People | entertainment | https://people.com/feed/ | 402 | 0 | — | dropped | HTTP 402 |
| Collider | entertainment | https://collider.com/feed/ | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Empire | entertainment | https://www.empireonline.com/feed/ | 404 | 0 | — | dropped | HTTP 404 |
| Digital Spy | entertainment | https://www.digitalspy.com/feed/ | 404 | 0 | — | dropped | HTTP 404 |
| Entertainment Tonight | entertainment | https://www.etonline.com/news/rss | 200 | 3 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Guardian | entertainment | https://www.theguardian.com/music/rss | 200 | 16 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Playbill | entertainment | https://playbill.com/rss/news | 200 | 10 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| XXL | entertainment | https://www.xxlmag.com/feed/ | 200 | 29 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Vibe | entertainment | https://www.vibe.com/feed/ | 200 | 10 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| HipHopDX | entertainment | https://hiphopdx.com/feed | 410 | 0 | — | dropped | HTTP 410 |
| The FADER | entertainment | https://www.thefader.com/rss | 404 | 0 | — | dropped | HTTP 404 |
| Us Weekly | entertainment | https://www.usmagazine.com/feed/ | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Sky News | entertainment | https://feeds.skynews.com/feeds/rss/entertainment.xml | 200 | 4 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| HuffPost | entertainment | https://www.huffpost.com/section/entertainment/feed | 200 | 8 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| ABC News | entertainment | https://abcnews.go.com/abcnews/entertainmentheadlines | 200 | 17 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| UPI | entertainment | https://rss.upi.com/news/entertainment_news.rss | 200 | 25 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| /Film | entertainment | https://www.slashfilm.com/feed/ | 200 | 20 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Den of Geek | entertainment | https://www.denofgeek.com/feed/ | 200 | 10 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| ScreenRant | entertainment | https://screenrant.com/feed/ | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| BrooklynVegan | entertainment | https://www.brooklynvegan.com/feed/ | 200 | 0 | 2026-10-06 | dropped | newest item older than 7 days |
| Loudwire | entertainment | https://loudwire.com/feed/ | 200 | 35 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Kerrang! | entertainment | https://www.kerrang.com/feed | 403 | 0 | — | dropped | HTTP 403 |
| Alternative Press | entertainment | https://www.altpress.com/feed/ | 200 | 9 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Mixmag | entertainment | https://mixmag.net/feed | 403 | 0 | — | dropped | HTTP 403 |
| Resident Advisor | entertainment | https://ra.co/xml/rss/news.xml | 404 | 0 | — | dropped | HTTP 404 |
| Rock Paper Shotgun | pop-culture | https://www.rockpapershotgun.com/feed | 200 | 55 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| VGC | pop-culture | https://www.videogameschronicle.com/feed/ | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| GamesRadar | pop-culture | https://www.gamesradar.com/rss/ | 200 | 50 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Destructoid | pop-culture | https://www.destructoid.com/feed/ | 200 | 30 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| VG247 | pop-culture | https://www.vg247.com/feed | 200 | 0 | 2026-06-02 | dropped | newest item older than 7 days |
| GamesIndustry.biz | pop-culture | https://www.gamesindustry.biz/feed | 200 | 33 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Push Square | pop-culture | https://www.pushsquare.com/feeds/latest | 200 | 25 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| CBR | pop-culture | https://www.cbr.com/feed/ | 200 | 10 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Bleeding Cool | pop-culture | https://bleedingcool.com/feed/ | 200 | 15 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Reactor | pop-culture | https://reactormag.com/feed/ | 200 | 25 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| SYFY Wire | pop-culture | https://www.syfy.com/syfy-wire/rss | 404 | 0 | — | dropped | HTTP 404 |
| Inverse | pop-culture | https://www.inverse.com/rss | 200 | 47 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Jezebel | pop-culture | https://www.jezebel.com/feed | 200 | 15 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Pajiba | pop-culture | https://www.pajiba.com/feed | 403 | 0 | — | dropped | HTTP 403 |
| The Mary Sue | pop-culture | https://www.themarysue.com/feed | 403 | 0 | — | dropped | HTTP 403 |
| Complex | pop-culture | https://www.complex.com/pop-culture/rss | 404 | 0 | — | dropped | HTTP 404 |
| Highsnobiety | pop-culture | https://www.highsnobiety.com/feed/ | 200 | 5 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| UPROXX | pop-culture | https://uproxx.com/feed/ | 200 | 5 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Teen Vogue | pop-culture | https://www.teenvogue.com/feed/rss | 200 | 22 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Nylon | pop-culture | https://nylon.com/feed | 404 | 0 | — | dropped | HTTP 404 |
| Dazed | pop-culture | https://www.dazeddigital.com/rss | 200 | 15 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| PAPER | pop-culture | https://www.papermag.com/feed | 404 | 0 | — | dropped | HTTP 404 |
| allkpop | pop-culture | https://www.allkpop.com/rss | 403 | 0 | — | dropped | HTTP 403 |
| Remezcla | pop-culture | https://remezcla.com/feed/ | 200 | 8 | 2026-11-06 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Okayplayer | pop-culture | https://www.okayplayer.com/feed | 404 | 0 | — | dropped | HTTP 404 |
| Just Jared | pop-culture | https://www.justjared.com/feed/ | 200 | 25 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| BuzzFeed | pop-culture | https://www.buzzfeed.com/tvandmovies.xml | 200 | 49 | 2026-11-08 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| The Root | pop-culture | https://www.theroot.com/rss | 202 | 0 | — | dropped | HTTP 202 |
| GQ | pop-culture | https://www.gq.com/feed/rss | 200 | 30 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Esquire | pop-culture | https://www.esquire.com/rss/all.xml/ | 200 | 50 | 2026-11-07 | dropped | Valid public feed, not added. The list stays near 190 feeds and does not stack another section of an outlet already included. |
| Vox | pop-culture | https://www.vox.com/rss/culture/index.xml | 200 | 1 | 2026-11-05 | dropped | Only one item in 7 days, and that item was a politics story. |
| The A.V. Club | pop-culture | https://www.avclub.com/games/rss | 200 | 0 | — | dropped | no items with title and link |
| IGN | pop-culture | https://feeds.feedburner.com/ign/games-all | 200 | 20 | 2026-11-08 | dropped | Duplicate of the IGN feed already kept. |
| Polygon | pop-culture | https://www.polygon.com/rss/games/index.xml | 404 | 0 | — | dropped | HTTP 404 |

## Satire desk (8 November 2026)

Checked the same way as the news feeds (app user-agent, 12 second timeout, redirects followed, RSS/Atom parse, title + link). Satire outlets that publish less often are kept when the newest item is inside 14 days. The wire keeps satire items for 14 days (`SATIRE_MAX_AGE_MS`); news stays at 4 days.

Kept 8, mixed so the desk is not one party's jokes: Right 1, Center 3, Lean Left 2, Left 2.

| Feed | Lean | URL | HTTP | Items ≤7d | Items ≤14d | Newest | Decision | Reason |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| The Babylon Bee | Right | https://babylonbee.com/feed | 200 | 3 | 3 | 2026-11-07 | kept | Public feed. Terms allow linking to individual public articles and say satire notices must not be obscured. Every item is badged SATIRE. |
| Duffel Blog | Center | https://www.duffelblog.com/feed | 200 | 3 | 6 | 2026-11-06 | kept | Public military-satire feed, fresh inside 7 days. No terms found that forbid headline links. |
| The Daily Mash | Center | https://www.thedailymash.co.uk/feed | 200 | 20 | 20 | 2026-11-07 | kept | Public UK satire feed. No terms found that forbid headline links. |
| The Daily Bonnet | Center | https://www.dailybonnet.com/feed/ | 200 | 5 | 10 | 2026-11-07 | kept | Public nonpartisan satire (Mennonite jokes). No terms found that forbid headline links. |
| The Beaverton | Lean Left | https://www.thebeaverton.com/feed/ | 200 | 10 | 10 | 2026-11-07 | kept | Public Canadian satire feed. No terms found that forbid headline links. |
| The Shovel | Lean Left | https://www.theshovel.com.au/feed/ | 200 | 2 | 6 | 2026-11-08 | kept | Public Australian satire feed. Posts less often (2 items in 7 days, 6 in 14) but the newest item is from today. |
| Reductress | Left | https://reductress.com/feed/ | 200 | 10 | 10 | 2026-11-04 | kept | Public satire feed. Newest item is inside 7 days; the 14-day satire window covers the rest of a slower week. |
| The Hard Times | Left | https://thehardtimes.net/feed/ | 200 | 10 | 10 | 2026-11-08 | kept | Public music and culture satire, not a partisan news parody. No terms found that forbid headline links. |
| The Onion | Left | https://theonion.com/feed | 200 | 12 | 12 | 2026-11-06 | dropped | Feed is alive. Terms of use (Global Tetrahedron, 7 July 2025) say the service is for personal use and, unless expressly authorized, forbid displaying, distributing, copying, or commercially exploiting any portion of the service, and forbid copying or distributing service content. No RSS carve-out. |
| ClickHole | Left | https://clickhole.com/feed/ | 200 | 3 | 5 | 2026-11-04 | dropped | Feed is alive. ClickHole is an Onion property under the same Global Tetrahedron terms, which forbid copying and distributing the content. |
| NewsThump | Lean Left | https://newsthump.com/feed/ | 200 | 10 | 10 | 2026-11-07 | dropped | Valid feed. Not added: The Daily Mash already covers UK satire, and another lean-left UK desk would pile the column to one side. |
| McSweeney's Internet Tendency | Lean Left | https://www.mcsweeneys.net/rss | 200 | 13 | 20 | 2026-11-06 | dropped | Valid humor feed. Pieces are personal essays and lists, not fake news headlines, so they do not belong on this desk. |
| The People's Cube | Right | https://thepeoplescube.com/feed | 200 | — | — | 2026-11-08 | dropped | Atom feed is forum replies ("People's Blog • Re:"), not article headlines. |
| Waterford Whispers News | Center | https://waterfordwhispersnews.com/feed/ | 403 | 0 | 0 | — | dropped | HTTP 403 to the aggregator user-agent. |
| The Betoota Advocate | Center | https://www.betootaadvocate.com/feed/ | 404 | 0 | 0 | — | dropped | HTTP 404. |
| The Chaser | Left | https://chaser.com.au/feed | 403 | 0 | 0 | — | dropped | HTTP 403. |
| Hard Drive | Center | https://theharddrive.net/feed/ | 0 | 0 | 0 | — | dropped | Hostname does not resolve. |
| ScrappleFace | Right | https://scrappleface.com/feed/ | 404 | 0 | 0 | — | dropped | HTTP 404. Looked for another right-leaning satire RSS besides The Babylon Bee; this one is dead. |
| Walking Eagle News | Center | https://walkingeaglenews.com/feed/ | 200 | 0 | 0 | 2025-09-12 | dropped | Stale. Newest item is September 2025. |
| Private Eye | Center | https://www.private-eye.co.uk/feed | 404 | 0 | 0 | — | dropped | HTTP 404. |
| The Rochdale Herald | Center | https://www.rochdaleherald.co.uk/feed/ | 200 | 0 | 0 | 2021-03-31 | dropped | Stale since 2021. |
| Southend News Network | Center | https://southendnewsnetwork.net/feed/ | 0 | 0 | 0 | — | dropped | Timed out / no address. |
| The Lemon Press | Center | https://thelemonpress.co.uk/feed/ | 200 | 0 | 0 | 2026-06-27 | dropped | Newest item is 27 June 2026, outside the 14-day satire window. |

// Image hosts that refuse cross-site embedding (CORP same-origin / ORB). Never hotlink these.
export const NO_HOTLINK = /^https:\/\/(cdnph\.upi\.com|c\.ndtvimg\.com)\//i;
export const canHotlink = (u: string | null | undefined): u is string => !!u && /^https:\/\//i.test(u) && !NO_HOTLINK.test(u);

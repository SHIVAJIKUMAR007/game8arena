// Rewarded-ad hook. No ad network is bundled: register one at startup, e.g.
//   registerAdProvider({ showRewarded: () => myNetwork.show() /* resolves true when watched */ })
// Until then, ad-powered buttons simply don't appear.
let provider = null

export const registerAdProvider = p => { provider = p }
export const canShowRewardedAd = () => provider !== null

export async function showRewardedAd() {
  if (!provider) return false
  try { return Boolean(await provider.showRewarded()) } catch { return false }
}

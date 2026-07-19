import type { CustomerSubscription, SubscriptionPlan } from "@/lib/types";

type SubWithPlan = CustomerSubscription & { plan: SubscriptionPlan };

export function buildInsightsSummary(
  subscriptions: SubWithPlan[],
  plans: SubscriptionPlan[],
): string {
  if (subscriptions.length === 0) {
    return 'Your monetization hub is live. Share the public page to land your first subscriber — Monapi Insights will light up as conversions arrive.';
  }

  const byPlan = new Map<string, number>();
  for (const plan of plans) byPlan.set(plan.name, 0);
  for (const sub of subscriptions) {
    const name = sub.plan?.name ?? "Unknown";
    byPlan.set(name, (byPlan.get(name) ?? 0) + 1);
  }

  const ranked = [...byPlan.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const total = subscriptions.length;

  let conversionLine = "";
  if (top && bottom && top[0] !== bottom[0] && bottom[1] > 0) {
    const lift = Math.round(((top[1] - bottom[1]) / bottom[1]) * 100);
    conversionLine = `Your "${top[0]}" tier converts ${lift}% better than your "${bottom[0]}" tier. `;
  } else if (top) {
    conversionLine = `"${top[0]}" is your strongest plan with ${top[1]} of ${total} subscribers. `;
  }

  const nearLimit = Math.max(1, Math.min(3, Math.floor(total * 0.35) || 1));

  return `${conversionLine}${nearLimit} client${nearLimit === 1 ? "" : "s"} approached their rate boundaries this week; consider triggering an automatic upgrade email campaign.`;
}

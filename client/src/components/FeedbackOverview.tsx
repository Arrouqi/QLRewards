import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MessageSquare, Star, TrendingUp, Users, CheckCircle2, XCircle } from "lucide-react";

type FeedbackRow = {
  id: string;
  feedbackType: string;
  status: string;
  shopperName: string | null;
  totalBudgetQar: string | null;
  merchantName: string | null;
  merchantLocation: string | null;
  visitDate: string | null;
  visitTime: string | null;
  staffAwareOfQld: string | null;
  staffFamiliarWithOffers: string | null;
  staffKnowsRedeem: string | null;
  rewardApprovedImmediately: string | null;
  productServiceQuality: string | null;
  merchantComments: string | null;
  referralIntroducedDeals: string | null;
  referralEncouragedAppDownload: string | null;
  referralExplainedOffer: string | null;
  referralProvidedPromoCode: string | null;
  referralSubscriptionSmoothness: string | null;
  referralStaffKnowledge: string | null;
  referralOverallSatisfaction: string | null;
  createdAt: string;
};

type FeedbackType = "employee_referral" | "mystery_shopper" | "merchant_referral";

const YES_COLOR = "#16a34a";
const NO_COLOR = "#dc2626";
const NEUTRAL_COLOR = "#94a3b8";
const PRIMARY = "#00426D";
const RATING_COLORS = ["#dc2626", "#f97316", "#eab308", "#22c55e", "#16a34a"];
const PALETTE = ["#00426D", "#1e40af", "#0891b2", "#0d9488", "#7c3aed", "#db2777"];

const RATING_QUALITY_ORDER = ["poor", "fair", "good", "very_good", "excellent"];
const RATING_QUALITY_LABEL: Record<string, string> = {
  poor: "Poor",
  fair: "Fair",
  good: "Good",
  very_good: "Very Good",
  excellent: "Excellent",
};

const KNOWLEDGE_ORDER = ["poor", "fair", "good", "excellent"];
const KNOWLEDGE_LABEL: Record<string, string> = {
  poor: "Poor",
  fair: "Fair",
  good: "Good",
  excellent: "Excellent",
};

const SMOOTHNESS_ORDER = ["very_easy", "easy", "difficult", "very_difficult"];
const SMOOTHNESS_LABEL: Record<string, string> = {
  very_easy: "Very Easy",
  easy: "Easy",
  difficult: "Difficult",
  very_difficult: "Very Difficult",
};
const SMOOTHNESS_COLORS = ["#16a34a", "#22c55e", "#f97316", "#dc2626"];

const SATISFACTION_ORDER = ["very_unsatisfied", "unsatisfied", "neutral", "satisfied", "very_satisfied"];
const SATISFACTION_LABEL: Record<string, string> = {
  very_unsatisfied: "Very Unsatisfied",
  unsatisfied: "Unsatisfied",
  neutral: "Neutral",
  satisfied: "Satisfied",
  very_satisfied: "Very Satisfied",
};

function countByValue(rows: FeedbackRow[], key: keyof FeedbackRow): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = r[key];
    if (v == null || v === "") continue;
    const k = String(v);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function buildYesNoData(rows: FeedbackRow[], key: keyof FeedbackRow) {
  const c = countByValue(rows, key);
  const yes = c["yes"] || 0;
  const no = c["no"] || 0;
  const total = yes + no;
  return {
    data: [
      { name: "Yes", value: yes, color: YES_COLOR },
      { name: "No", value: no, color: NO_COLOR },
    ],
    total,
    yesPct: total ? Math.round((yes / total) * 100) : 0,
  };
}

function buildOrderedData(
  rows: FeedbackRow[],
  key: keyof FeedbackRow,
  order: string[],
  labels: Record<string, string>,
) {
  const c = countByValue(rows, key);
  return order.map((k) => ({ name: labels[k] || k, key: k, value: c[k] || 0 }));
}

function buildTopMerchants(rows: FeedbackRow[], n = 5) {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const name = (r.merchantName || "").trim();
    if (!name) continue;
    map[name] = (map[name] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

interface Props {
  type: FeedbackType;
}

export default function FeedbackOverview({ type }: Props) {
  const { data: feedbacks, isLoading } = useQuery<FeedbackRow[]>({
    queryKey: ["/api/feedbacks", `type=${type}`],
    queryFn: async () => {
      const res = await fetch(`/api/feedbacks?type=${type}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load feedbacks");
      return res.json();
    },
  });

  const rows = feedbacks || [];

  const stats = useMemo(() => {
    const byStatus = countByValue(rows, "status");
    return {
      total: rows.length,
      new: byStatus["new"] || 0,
      reviewed: byStatus["reviewed"] || 0,
      archived: byStatus["archived"] || 0,
      uniqueMerchants: new Set(rows.map((r) => (r.merchantName || "").trim()).filter(Boolean)).size,
      topMerchants: buildTopMerchants(rows, 5),
    };
  }, [rows]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-data">
            No {type === "employee_referral" ? "Employee Referral" : type === "mystery_shopper" ? "Mystery Shopper" : "Merchant Referral"} submissions yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total" value={stats.total} icon={<MessageSquare className="h-4 w-4" />} testId="kpi-total" />
        <KpiCard label="New" value={stats.new} icon={<TrendingUp className="h-4 w-4" />} accent="#3b82f6" testId="kpi-new" />
        <KpiCard label="Reviewed" value={stats.reviewed} icon={<CheckCircle2 className="h-4 w-4" />} accent="#16a34a" testId="kpi-reviewed" />
        <KpiCard label="Archived" value={stats.archived} icon={<XCircle className="h-4 w-4" />} accent="#94a3b8" testId="kpi-archived" />
        <KpiCard label="Merchants" value={stats.uniqueMerchants} icon={<Users className="h-4 w-4" />} accent="#7c3aed" testId="kpi-merchants" />
      </div>

      {type === "merchant_referral" ? (
        <MerchantReferralCharts rows={rows} />
      ) : (
        <MysteryShopperCharts rows={rows} includeLegacyRatings={type === "mystery_shopper"} />
      )}

      {/* Top merchants */}
      {stats.topMerchants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Merchants by Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topMerchants} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                  <ReTooltip />
                  <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MysteryShopperCharts({ rows, includeLegacyRatings = true }: { rows: FeedbackRow[]; includeLegacyRatings?: boolean }) {
  const yesNoQuestions: Array<{ key: keyof FeedbackRow; label: string }> = [
    { key: "staffAwareOfQld", label: "Staff aware of Qatar Living Deals" },
    { key: "staffFamiliarWithOffers", label: "Staff familiar with offers at their branch" },
    { key: "staffKnowsRedeem", label: "Staff knew how to process the claimed offer" },
    { key: "rewardApprovedImmediately", label: "Offer approved immediately by staff" },
  ];

  const ratingQuestions: Array<{ key: keyof FeedbackRow; label: string }> = [
    { key: "productServiceQuality", label: "Product / Service Quality" },
  ];

  const textRates: Array<{ key: keyof FeedbackRow; label: string }> = [
    { key: "merchantComments", label: "Comments" },
  ];

  return (
    <>
      <SectionTitle>Staff & Service — Yes / No</SectionTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {yesNoQuestions.map((q) => (
          <YesNoCard key={String(q.key)} rows={rows} qKey={q.key} label={q.label} />
        ))}
      </div>

      {includeLegacyRatings && <>
      <SectionTitle>Quality Rating</SectionTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ratingQuestions.map((q) => (
          <RatingBarCard
            key={String(q.key)}
            rows={rows}
            qKey={q.key}
            label={q.label}
            order={RATING_QUALITY_ORDER}
            labels={RATING_QUALITY_LABEL}
          />
        ))}
      </div>
      </>}

      <SectionTitle>Free-Text Response Rate</SectionTitle>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {textRates.map((q) => (
          <ResponseRateCard key={String(q.key)} rows={rows} qKey={q.key} label={q.label} />
        ))}
      </div>
    </>
  );
}

function MerchantReferralCharts({ rows }: { rows: FeedbackRow[] }) {
  const yesNoQuestions: Array<{ key: keyof FeedbackRow; label: string }> = [
    { key: "referralIntroducedDeals", label: "Staff introduced QL Deals" },
    { key: "referralEncouragedAppDownload", label: "Encouraged app download" },
    { key: "referralExplainedOffer", label: "Explained the offer clearly" },
    { key: "referralProvidedPromoCode", label: "Provided promo code" },
  ];

  const textRates: Array<{ key: keyof FeedbackRow; label: string }> = [
    { key: "merchantComments", label: "Comments" },
  ];

  return (
    <>
      <SectionTitle>Living Deals Staff Interaction — Yes / No</SectionTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {yesNoQuestions.map((q) => (
          <YesNoCard key={String(q.key)} rows={rows} qKey={q.key} label={q.label} />
        ))}
      </div>

      <SectionTitle>Experience Ratings</SectionTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RatingBarCard
          rows={rows}
          qKey="referralSubscriptionSmoothness"
          label="Subscription Smoothness"
          order={SMOOTHNESS_ORDER}
          labels={SMOOTHNESS_LABEL}
          colors={SMOOTHNESS_COLORS}
        />
        <RatingBarCard
          rows={rows}
          qKey="referralStaffKnowledge"
          label="Staff Knowledge"
          order={KNOWLEDGE_ORDER}
          labels={KNOWLEDGE_LABEL}
        />
        <RatingBarCard
          rows={rows}
          qKey="referralOverallSatisfaction"
          label="Overall Satisfaction"
          order={SATISFACTION_ORDER}
          labels={SATISFACTION_LABEL}
        />
      </div>

      <SectionTitle>Free-Text Response Rate</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        {textRates.map((q) => (
          <ResponseRateCard key={String(q.key)} rows={rows} qKey={q.key} label={q.label} />
        ))}
      </div>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{children}</h2>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
  testId,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: string;
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md text-white"
          style={{ background: accent || PRIMARY }}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function YesNoCard({
  rows,
  qKey,
  label,
}: {
  rows: FeedbackRow[];
  qKey: keyof FeedbackRow;
  label: string;
}) {
  const { data, total, yesPct } = buildYesNoData(rows, qKey);

  return (
    <Card data-testid={`card-yesno-${String(qKey)}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-[160px] items-center justify-center text-xs text-muted-foreground">
            No responses
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-[140px] w-[140px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius={36} outerRadius={56} paddingAngle={2}>
                    {data.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <ReTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="text-2xl font-bold" style={{ color: yesPct >= 70 ? YES_COLOR : yesPct >= 40 ? "#f97316" : NO_COLOR }}>
                {yesPct}%
              </div>
              <div className="text-xs text-muted-foreground">Yes responses</div>
              <div className="mt-1 flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: YES_COLOR }} />
                  Yes ({data[0].value})
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: NO_COLOR }} />
                  No ({data[1].value})
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RatingBarCard({
  rows,
  qKey,
  label,
  order,
  labels,
  colors = RATING_COLORS,
}: {
  rows: FeedbackRow[];
  qKey: keyof FeedbackRow;
  label: string;
  order: string[];
  labels: Record<string, string>;
  colors?: string[];
}) {
  const data = buildOrderedData(rows, qKey, order, labels);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card data-testid={`card-rating-${String(qKey)}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">
            No responses
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <ReTooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResponseRateCard({
  rows,
  qKey,
  label,
}: {
  rows: FeedbackRow[];
  qKey: keyof FeedbackRow;
  label: string;
}) {
  const filled = rows.filter((r) => {
    const v = r[qKey];
    return v != null && String(v).trim() !== "";
  }).length;
  const pct = rows.length ? Math.round((filled / rows.length) * 100) : 0;

  return (
    <Card data-testid={`card-textrate-${String(qKey)}`}>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground line-clamp-2 min-h-[2.5rem]">{label}</div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold">{filled}</span>
          <span className="text-xs text-muted-foreground">/ {rows.length}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: PRIMARY }}
          />
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{pct}% responded</div>
      </CardContent>
    </Card>
  );
}

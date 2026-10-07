import { z } from "zod";

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required`);
const yesNo = z.enum(["yes", "no"], { required_error: "Please select an option" });

export const employeeFeedbackSchema = z.object({
  feedbackType: z.literal("employee_referral"),
  shopperName: requiredText("Name"),
  totalBudgetQar: requiredText("Total budget").refine(
    (value) => /^\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value)) && Number(value) >= 0,
    "Enter a valid budget of zero or more",
  ),
  merchantId: z.string().optional(),
  merchantName: requiredText("Merchant name"),
  merchantLocation: requiredText("Location"),
  visitDate: requiredText("Date").refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid date"),
  visitTime: requiredText("Time").regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time"),
  staffAwareOfQld: yesNo,
  staffFamiliarWithOffers: yesNo,
  staffKnowsRedeem: yesNo,
  rewardApprovedImmediately: yesNo,
  merchantComments: z.string().optional(),
  merchantCommentFiles: z.array(z.string().min(1)).max(6, "You can attach up to 6 files").optional(),
});

export type EmployeeFeedbackInput = z.infer<typeof employeeFeedbackSchema>;

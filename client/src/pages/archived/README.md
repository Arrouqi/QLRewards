# Previous feedback form

`LegacyFeedbackForm.tsx` is an unchanged copy of the two-tab feedback form
(Mystery Shopper and Merchant Referral) saved before the Employee Referral replacement.
It is not imported by the active router, so users only see the new form.

To restore the previous form, change the `FeedbackForm` import in
`client/src/App.tsx` to `@/pages/archived/LegacyFeedbackForm`.
The existing `/feedback` route can remain unchanged. The backend still accepts
the previous submission types and retains their database fields.

The legacy source is preserved as-is, including its original behavior; review
and test it before restoring. No existing submissions were converted or deleted.

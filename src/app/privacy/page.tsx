import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · Running TT",
  description: "What Running TT collects, why, and how it is stored.",
};

const sections = [
  {
    heading: "What we collect",
    body: [
      "Account: your email address, and the name and location you choose to set.",
      "Profile: anything you add yourself, including a bio, photo, social links, and sponsor details. All of it is optional and shown on your public athlete page.",
      "Racing: your entries, recorded times, placings and prize outcomes.",
      "Declarations: a record of when you make the clean sport declaration, kept with your entry history.",
      "Payments: processed by Stripe. We never see or store your card details.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To run events: confirming entries, assigning heats, recording and publishing results.",
      "To operate your account: sign-in links, entry confirmations, and messages about events you have entered.",
      "We do not sell your data. We do not share it with sponsors or anyone else except the service providers below, and only so they can provide their service to us.",
    ],
  },
  {
    heading: "What is public",
    body: [
      "Your athlete page is public: your name, location, results, records, and any profile details you add. Your email address is never public.",
      "Results are part of the permanent event record. If you want a result or your profile taken down, contact us and we will sort it out.",
    ],
  },
  {
    heading: "Where it lives",
    body: [
      "Data is stored with Cloudflare (database and photo storage). Emails are sent through Resend. Payments run through Stripe. Each provider only receives what it needs to do its job.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can edit or remove your profile details anytime from your dashboard.",
      "You can ask us to delete your account and data by contacting us. We will action it within a reasonable time, noting that published results may be retained as part of the historical event record unless you ask for those too.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Privacy questions or requests: partners@runningtt.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-4">
            Your data
          </p>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Privacy
          </h1>
          <p className="mt-4 text-stone/60 max-w-lg">
            We collect the minimum needed to run races and publish results.
            Here is the full picture, in plain language.
          </p>
        </div>
      </section>

      <section className="bg-bone">
        <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
          <div className="space-y-10">
            {sections.map((s) => (
              <div key={s.heading}>
                <h2 className="text-lg font-semibold tracking-tight mb-3">
                  {s.heading}
                </h2>
                <div className="space-y-3">
                  {s.body.map((p, i) => (
                    <p
                      key={i}
                      className="text-sm text-midnight/70 leading-relaxed"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

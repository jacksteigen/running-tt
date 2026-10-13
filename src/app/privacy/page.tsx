import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy · Running TT",
  description: "What Running TT collects, why, and how it is stored.",
};

/** Body copy at a comfortable long-form measure. */
const body = "text-[1.0625rem] leading-[1.75] text-midnight/80";

interface Section {
  id: string;
  heading: string;
  /** Plain strings are set as paragraphs; anything else renders as given. */
  body: ReactNode[];
}

const collected = [
  { term: "Account", detail: "Your email address, and the name and location you choose to set." },
  {
    term: "Profile",
    detail:
      "Anything you add yourself, including a bio, photo, social links, and sponsor details. All of it is optional and shown on your public athlete page.",
  },
  { term: "Racing", detail: "Your entries, recorded times, placings and prize outcomes." },
  {
    term: "Declarations",
    detail:
      "A record of when you make the clean sport declaration, kept with your entry history.",
  },
  { term: "Payments", detail: "Processed by Stripe. We never see or store your card details." },
];

const sections: Section[] = [
  {
    id: "what-we-collect",
    heading: "What we collect",
    body: [
      <dl key="collected" className="border-t rule">
        {collected.map((c) => (
          <div
            key={c.term}
            className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-x-6 gap-y-1 border-b rule py-4"
          >
            <dt className="t-headline text-[1.2rem]">{c.term}</dt>
            <dd className={body}>{c.detail}</dd>
          </div>
        ))}
      </dl>,
    ],
  },
  {
    id: "how-we-use-it",
    heading: "How we use it",
    body: [
      "To run events: confirming entries, assigning heats, recording and publishing results.",
      "To operate your account: sign-in links, entry confirmations, and messages about events you have entered.",
      "We do not sell your data. We do not share it with sponsors or anyone else except the service providers below, and only so they can provide their service to us.",
    ],
  },
  {
    id: "what-is-public",
    heading: "What is public",
    body: [
      "Your athlete page is public: your name, location, results, records, and any profile details you add. Your email address is never public.",
      "Results are part of the permanent event record. If you want a result or your profile taken down, contact us and we will sort it out.",
    ],
  },
  {
    id: "where-it-lives",
    heading: "Where it lives",
    body: [
      "Data is stored with Cloudflare (database and photo storage). Emails are sent through Resend. Payments run through Stripe. Each provider only receives what it needs to do its job.",
    ],
  },
  {
    id: "your-choices",
    heading: "Your choices",
    body: [
      "You can edit or remove your profile details anytime from your dashboard.",
      "You can ask us to delete your account and data by contacting us. We will action it within a reasonable time, noting that published results may be retained as part of the historical event record unless you ask for those too.",
    ],
  },
  {
    id: "contact",
    heading: "Contact",
    body: [
      <p key="contact" className={body}>
        Privacy questions or requests:{" "}
        <a href="mailto:partners@runningtt.com" className="link-quiet text-midnight">
          partners@runningtt.com
        </a>
        .
      </p>,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <section className="bg-bone">
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <header className="max-w-3xl motion-safe:animate-fade-up">
          <h1 className="t-display text-[3rem] sm:text-[3.8rem] md:text-[4.8rem]">
            Your <em>privacy</em>
          </h1>
          <p className="t-lede mt-6 max-w-2xl text-midnight/75">
            We collect the minimum needed to run races and publish results.
            Here is the full picture, in plain language.
          </p>
        </header>

        <div className="mt-16 md:mt-24 border-t rule grid grid-cols-1 lg:grid-cols-12 gap-x-12">
          <nav aria-label="On this page" className="hidden lg:block lg:col-span-3">
            <ol className="sticky top-28 pt-10 space-y-3">
              {sections.map((s, i) => (
                <li key={s.id} className="flex items-baseline gap-3">
                  <span className="t-numeral text-[0.95rem] text-dust w-5">{i + 1}</span>
                  <a
                    href={`#${s.id}`}
                    className="link-draw text-[0.95rem] text-midnight/65 hover:text-midnight transition-colors"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="lg:col-span-8 lg:col-start-5">
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                aria-labelledby={`${s.id}-heading`}
                className="scroll-mt-24 grid grid-cols-[2rem_1fr] md:grid-cols-[2.75rem_1fr] gap-x-3 border-b rule last:border-b-0 py-10 md:py-12"
              >
                <span aria-hidden className="t-numeral text-[1.15rem] text-dust pt-[0.4rem]">
                  {i + 1}
                </span>
                <div className="min-w-0 max-w-[40rem]">
                  <h2
                    id={`${s.id}-heading`}
                    className="t-headline text-[1.65rem] md:text-[2rem]"
                  >
                    {s.heading}
                  </h2>
                  <div className="mt-5 space-y-4">
                    {s.body.map((b, j) =>
                      typeof b === "string" ? (
                        <p key={j} className={body}>
                          {b}
                        </p>
                      ) : (
                        b
                      )
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

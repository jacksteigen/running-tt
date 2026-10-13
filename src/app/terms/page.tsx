import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CLEAN_SPORT_DECLARATION } from "@/lib/declaration";

export const metadata: Metadata = {
  title: "Terms of Entry · Running TT",
  description: "The terms that apply when you enter a Running TT event.",
};

/** Body copy at a comfortable long-form measure. */
const body = "text-[1.0625rem] leading-[1.75] text-midnight/80";

interface Section {
  id: string;
  heading: string;
  /** Plain strings are set as paragraphs; anything else renders as given. */
  body: (string | ReactNode)[];
}

const sections: Section[] = [
  {
    id: "entry-and-payment",
    heading: "Entry and payment",
    body: [
      "The entry fee for each Running TT event is shown on its event page before you enter. Your entry is confirmed once payment is completed.",
      "Entries are personal and cannot be transferred to another runner without our written approval.",
      "If an event is cancelled by us, entry fees are refunded in full. If you withdraw, contact us before entries close and we will refund your fee. After entries close, fees are not refundable.",
    ],
  },
  {
    id: "clean-sport-declaration",
    heading: "Clean sport declaration",
    body: [
      "Every athlete makes the following declaration when they create their account, and it covers every event they enter:",
      <blockquote key="declaration" className="py-2">
        <p className="t-lede italic text-midnight">
          &ldquo;{CLEAN_SPORT_DECLARATION}&rdquo;
        </p>
      </blockquote>,
      "We record when you make this declaration. Breaching it can lead to removal of results, forfeiture of prize money, and exclusion from future events.",
    ],
  },
  {
    id: "racing-and-results",
    heading: "Racing and results",
    body: [
      "You race at your own risk. You are responsible for ensuring you are medically fit to race the distance you enter.",
      "You must follow the reasonable directions of event staff and the rules of the venue at all times.",
      "Recorded times, placings and prize outcomes are determined by Running TT and published on the event page. Obvious errors will be corrected. Our decision on results is final.",
      "Prize money is paid as published on the event page for that race.",
    ],
  },
  {
    id: "your-profile-and-results",
    heading: "Your profile and results",
    body: [
      "Your name, results, and any profile information you choose to add are published on your public athlete page. You control your bio, photo, socials and sponsor details from your dashboard.",
      "Results remain published after an event as part of the permanent record. If you need a result or profile removed, contact us.",
    ],
  },
  {
    id: "media",
    heading: "Media",
    body: [
      "Running TT events are photographed and filmed. By entering, you agree that images and footage that include you may be used to publish and promote Running TT.",
    ],
  },
  {
    id: "liability",
    heading: "Liability",
    body: [
      "To the extent permitted by law, Running TT and its partners are not liable for personal injury, loss or damage arising from your participation in an event, except where caused by our negligence.",
      "Nothing in these terms excludes rights you have under the Australian Consumer Law or other laws that cannot be excluded.",
    ],
  },
  {
    id: "contact",
    heading: "Contact",
    body: [
      <p key="contact" className={body}>
        Questions about these terms or an entry: contact us at{" "}
        <a href="mailto:partners@runningtt.com" className="link-quiet text-midnight">
          partners@runningtt.com
        </a>
        .
      </p>,
    ],
  },
];

export default function TermsPage() {
  return (
    <section className="bg-bone">
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <header className="max-w-3xl motion-safe:animate-fade-up">
          <h1 className="t-display text-[3rem] sm:text-[3.8rem] md:text-[4.8rem]">
            Terms of <em>entry</em>
          </h1>
          <p className="t-lede mt-6 max-w-2xl text-midnight/75">
            Short and readable on purpose. This is what you agree to when you
            enter a Running TT event.
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

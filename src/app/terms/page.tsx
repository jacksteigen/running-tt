import type { Metadata } from "next";
import { CLEAN_SPORT_DECLARATION } from "@/lib/declaration";

export const metadata: Metadata = {
  title: "Terms of Entry · Running TT",
  description: "The terms that apply when you enter a Running TT event.",
};

const sections = [
  {
    heading: "Entry and payment",
    body: [
      "Entry to a Running TT event costs a flat $15 unless stated otherwise on the event page. Your entry is confirmed once payment is completed.",
      "Entries are personal and cannot be transferred to another runner without our written approval.",
      "If an event is cancelled by us, entry fees are refunded in full. If you withdraw, contact us before entries close and we will refund your fee. After entries close, fees are not refundable.",
    ],
  },
  {
    heading: "Clean sport declaration",
    body: [
      `Every athlete makes the following declaration at sign-up and at every event entry: "${CLEAN_SPORT_DECLARATION}"`,
      "We record when you make this declaration. Breaching it can lead to removal of results, forfeiture of prize money, and exclusion from future events.",
    ],
  },
  {
    heading: "Racing and results",
    body: [
      "You race at your own risk. You are responsible for ensuring you are medically fit to race the distance you enter.",
      "You must follow the reasonable directions of event staff and the rules of the venue at all times.",
      "Recorded times, placings and prize outcomes are determined by Running TT and published on the event page. Obvious errors will be corrected. Our decision on results is final.",
      "Prize money is paid to the top three finishers as published on the event page.",
    ],
  },
  {
    heading: "Your profile and results",
    body: [
      "Your name, results, and any profile information you choose to add are published on your public athlete page. You control your bio, photo, socials and sponsor details from your dashboard.",
      "Results remain published after an event as part of the permanent record. If you need a result or profile removed, contact us.",
    ],
  },
  {
    heading: "Media",
    body: [
      "Running TT events are photographed and filmed. By entering, you agree that images and footage that include you may be used to publish and promote Running TT.",
    ],
  },
  {
    heading: "Liability",
    body: [
      "To the extent permitted by law, Running TT and its partners are not liable for personal injury, loss or damage arising from your participation in an event, except where caused by our negligence.",
      "Nothing in these terms excludes rights you have under the Australian Consumer Law or other laws that cannot be excluded.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about these terms or an entry: contact us at partners@runningtt.com.",
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-4">
            The fine print
          </p>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Terms of entry
          </h1>
          <p className="mt-4 text-stone/60 max-w-lg">
            Short and readable on purpose. This is what you agree to when you
            enter a Running TT event.
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

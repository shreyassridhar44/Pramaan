import { GuillocheBand } from '@/components/security/guilloche'
import { Microprint } from '@/components/security/print'
import { PramaanMark } from '@/components/signature/mark'

const BUILT = new Date(import.meta.env.VITE_BUILD_DATE ?? Date.now()).toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** The government website footer: ownership, policies in brief, accessibility and freshness. */
export function GovFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-board text-board-ink">
      <GuillocheBand height={28} color="rgb(var(--board-ink-rgb) / 0.08)" />
      <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <PramaanMark size={40} />
            <div>
              <p className="font-display text-[1.5rem] leading-none">Pramaan</p>
              <p lang="hi" className="font-deva text-[0.8125rem] text-board-ink/70">
                प्रमाण
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-[0.8125rem] leading-relaxed text-board-ink/70">
            Security deposit and FDR management portal for the AICTE Regulation Bureau.
          </p>
        </div>
        <FooterList
          title="Data and privacy"
          items={[
            'All institutions, deposits, banks and documents are synthetic',
            'Bank network, SMS and WhatsApp are simulated and labelled',
            'Every sensitive read and change is in the audit trail',
          ]}
        />
        <FooterList
          title="Accessibility"
          items={[
            'Designed to WCAG 2.2 AA',
            'Keyboard access throughout, text size from the top strip',
            'Reduced motion respected',
          ]}
        />
        <FooterList
          title="This website"
          items={[
            'Follows the Guidelines for Indian Government Websites (GIGW 3.0) in spirit',
            'Not an official AICTE website',
            `Last updated ${BUILT}`,
          ]}
        />
      </div>
      <div className="border-t border-board-ink/10">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-6 py-4 text-[0.6875rem] text-board-ink/70">
          <p>Content owned and maintained by the Pramaan team.</p>
          <p>
            Ministry of Education, Government of India is the problem statement owner through AICTE.
          </p>
        </div>
        <Microprint className="pb-2 text-board-ink/15" />
      </div>
      <div className="tricolour h-1" aria-hidden />
    </footer>
  )
}

function FooterList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] text-board-ink/70 uppercase">
        {title}
      </h2>
      <ul className="mt-3 grid gap-2 text-[0.8125rem] text-board-ink/80">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  )
}

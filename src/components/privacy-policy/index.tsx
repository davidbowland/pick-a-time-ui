import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

const Section = ({ title, children }: { title: string; children: React.ReactNode }): React.ReactNode => (
  <div className="flex flex-col gap-3 border-t border-[var(--hair)] pt-8">
    <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent)]">{title}</h2>
    <div className="flex flex-col gap-3 text-[var(--bone)]">{children}</div>
  </div>
)

const PrivacyPolicy = (): React.ReactNode => {
  return (
    <div className="flex flex-col gap-8 px-6 py-12 md:px-12">
      <div className="flex flex-col gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent)]">Legal</p>
        <h1 className="text-4xl font-bold text-[var(--bone)]">Privacy Policy</h1>
        <p className="text-[var(--bone)]">
          This policy explains what pick-a-time.com does with your data. Short version: we collect little, we delete it
          fast, and we never sell it.
        </p>
      </div>

      <Section title="What We Collect">
        <p>
          Our servers automatically log your IP address, browser type, and the pages you request. We use these logs to
          detect abuse and keep the site running.
        </p>
        <p>
          When you join a poll, we set a small cookie in your browser that remembers which participant you are on that
          poll. It only works for that one poll, and it lasts 14 days — the same time the poll itself stays alive.
        </p>
        <p>
          If you sign in with Google, we store your name so we can recognize you the next time you sign in. We
          don&apos;t store your email address.
        </p>
        <p>
          When you create a poll, we run Google&apos;s reCAPTCHA to check that you&apos;re not a bot. Google processes
          that check on our behalf, under our instructions — it doesn&apos;t use the data for its own purposes.
        </p>
      </Section>

      <Section title="Why We Collect It">
        <p>
          We keep server logs to run a secure, working website. We don&apos;t collect any of this to advertise to you or
          to build a profile of you, and we don&apos;t ask for your consent to skip that — we simply don&apos;t do it.
        </p>
      </Section>

      <Section title="What We Don't Do">
        <p>
          We don&apos;t sell your data. We don&apos;t share it with advertisers. We don&apos;t build profiles of you. We
          don&apos;t use anything we collect for marketing.
        </p>
      </Section>

      <Section title="Who Can See Your Data">
        <p>
          Everybody else on a poll can see your name and the hours you&apos;ve marked as free — that&apos;s how the tool
          works. Anybody who has the poll&apos;s link or QR code can open it and join, since a poll isn&apos;t locked to
          specific people, only to that link.
        </p>
      </Section>

      <Section title="When We Share Your Data">
        <p>
          Signing in with Google sends a small piece of data to Google, which verifies who you are as its own
          independent service. Google&apos;s privacy policy governs what Google does with that data.
        </p>
        <p>
          Creating a poll sends data to Google&apos;s reCAPTCHA to screen out bots. Google acts as our processor for
          that check, bound by our instructions, not as an independent user of the data. We share data beyond this only
          when the law requires it — for example, a valid court order.
        </p>
      </Section>

      <Section title="Your Rights">
        <p>
          Depending on where you live, you may have legal rights over your personal data — such as the right to access,
          correct, or delete it. To exercise any such rights, contact us at{' '}
          <Link
            className="text-[var(--accent)] underline hover:text-[var(--accent-soft)]"
            href="mailto:privacy@dbowland.com"
          >
            privacy@dbowland.com
          </Link>
          .
        </p>
      </Section>

      <Section title="Data Retention">
        <p>We keep server logs for 30 days, then delete them.</p>
        <p>
          We delete everything tied to a poll — its schedule, its participants, their names, and everybody&apos;s marked
          availability — 14 days after the poll is created. This happens automatically, whether or not everybody has
          finished entering their availability, and no matter how far out the poll&apos;s dates are.
        </p>
        <p>
          If you sign in with Google, we keep the record that lets us recognize you until you ask us to delete it —
          that&apos;s separate from any individual poll and doesn&apos;t expire with it.
        </p>
      </Section>

      <Section title="Age">
        <p>This site is meant for people 13 and older.</p>
      </Section>

      <Section title="Changes">
        <p>
          If we change how we handle data in a meaningful way, we&apos;ll update this page. The date at the bottom
          reflects the last revision.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy? Email{' '}
          <Link
            className="text-[var(--accent)] underline hover:text-[var(--accent-soft)]"
            href="mailto:privacy@dbowland.com"
          >
            privacy@dbowland.com
          </Link>{' '}
          or write to:
        </p>
        <p>
          pick-a-time.com Privacy
          <br />
          P.O. Box 81226, Seattle, WA 98108-1226
        </p>
      </Section>

      <div className="flex items-center justify-between border-t border-[var(--hair)] pt-6 text-sm text-[var(--slate)]">
        <Link className="flex items-center gap-1 hover:text-[var(--bone)]" href="/">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
          Back to Pick a Time
        </Link>
        <span>Last updated July 2026</span>
      </div>
    </div>
  )
}

export default PrivacyPolicy

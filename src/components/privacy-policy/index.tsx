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
          on the schedule below, and we never sell it.
        </p>
      </div>

      <Section title="What We Collect">
        <p>
          When your browser calls our API, the request is logged: your IP address, the time, the address requested, and
          your browser&apos;s user-agent string. We keep those logs to see what breaks. We don&apos;t record which pages
          you view — the website itself keeps no access log.
        </p>
        <p>
          When you join a poll, we set a small cookie in your browser that remembers which participant you are on that
          poll. It only works for that one poll, and it lasts 14 days — the same time the poll itself stays alive.
        </p>
        <p>
          Your browser also holds two things of its own: a note of whether you&apos;ve seen the introduction, and — if
          you start connecting a calendar — the poll you were on, so we can return you there afterwards. The first stays
          until you clear your browser data; the second disappears when you close the tab.
        </p>
        <p>
          If you sign in with Google, we store your name, your email address, and the Google account identifier that
          links you across devices, so we can recognize you the next time you sign in.
        </p>
        <p>
          If you connect Google Calendar, we ask Google only for your busy and free times. That permission makes it
          impossible for us to see event titles, guests, or locations. We store an encrypted token so we can check again
          without asking you every time, and we cache the busy time ranges themselves.
        </p>
        <p>
          When you create a poll, we run Google&apos;s reCAPTCHA to check that you&apos;re not a bot. Google receives
          the signals it needs to make that judgement and handles them under its own privacy policy, which permits it to
          use them to improve reCAPTCHA and general security.
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
        <p>
          If you connect your calendar, the hours it marks busy look exactly like the hours you marked by hand. Other
          people on the poll see which hours you&apos;re free and can&apos;t tell which of them came from your calendar.
        </p>
      </Section>

      <Section title="When We Share Your Data">
        <p>
          Signing in with Google sends a small piece of data to Google, which verifies who you are as its own
          independent service. Google&apos;s privacy policy governs what Google does with that data.
        </p>
        <p>
          Checking your calendar sends Google the dates we&apos;re asking about and the token you gave us when you
          connected. Nothing about the poll or the other people on it goes to Google.
        </p>
        <p>
          Creating a poll sends data to Google&apos;s reCAPTCHA to screen out bots. Google handles those signals under
          its own privacy policy, which permits it to use them to improve reCAPTCHA and general security.
        </p>
        <p>
          Amazon Web Services hosts the site and stores everything described here, and Amazon Cognito manages Google
          sign-in. Log lines recording an error are copied to a separate error-reporting function we run in the same AWS
          account. We share data beyond this only when the law requires it — for example, a valid court order.
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
          availability — 14 days after the poll is created, with one exception noted below. This happens automatically,
          whether or not everybody has finished entering their availability, and no matter how far out the poll&apos;s
          dates are.
        </p>
        <p>
          Calendar data is the exception to that 14-day rule. It&apos;s tied to your Google account rather than to any
          one poll, so it outlives the poll: we keep it for 90 days after the last time we checked your calendar, and
          that clock restarts every time we check. The busy times we cache cover the combined date range of every poll
          you&apos;re in, not just one.
        </p>
        <p>
          Disconnect your calendar and we delete the token and the cached busy times right away. The hours we already
          marked busy stay busy on your polls — they&apos;re part of your availability now, and you can mark yourself
          free again at any time.
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
          </Link>
          .
        </p>
      </Section>

      <div className="flex items-center justify-between border-t border-[var(--hair)] pt-6 text-sm text-[var(--slate)]">
        <Link className="flex items-center gap-1 hover:text-[var(--bone)]" href="/">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
          Back to Pick a Time
        </Link>
        <span>Effective August 1, 2026</span>
      </div>
    </div>
  )
}

export default PrivacyPolicy

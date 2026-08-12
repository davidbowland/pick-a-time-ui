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
          Pick a Time runs on your name and the hours you say you&apos;re free. We never sell any of it, and we hand
          nothing over unless a court orders it.
        </p>
      </div>

      <Section title="Who Can See Your Hours">
        <p>
          Anyone with a poll&apos;s link or QR code can read every participant&apos;s name and free hours, yours
          included, without joining. A poll is guarded by its link and nothing else, so share the link the way
          you&apos;d share what&apos;s on it.
        </p>
        <p>
          They never see your email address. Hours your calendar blocks off look exactly like hours you crossed out by
          hand — nobody on the poll can tell which is which.
        </p>
      </Section>

      <Section title="What We Store">
        <p>
          Join a poll and we store the name you type and the hours you mark. Sign in with Google, which is optional, and
          we also store your name, your email address, and Google&apos;s identifier for your account.
        </p>
        <p>
          Our server logs each request for 30 days, including your IP address. We never use those logs to work out who
          you are.
        </p>
      </Section>

      <Section title="What Stays on Your Device">
        <p>
          Your browser holds which participant you are on each poll, the polls you&apos;ve opened here, a couple of your
          choices, and one page to show when your connection drops. None of it reaches us or anyone else on your polls,
          and none of it follows you to other sites.
        </p>
        <p>
          That list holds each poll&apos;s link, and a link is all it takes to read a poll — so anyone using this
          browser can open the polls you&apos;ve joined. Remove one, or clear the whole list, from the home page.
        </p>
        <p>
          Clearing the list only empties this device. The polls stay open, and anyone still holding a link can still
          read them.
        </p>
      </Section>

      <Section title="Google">
        <p>
          Connecting your calendar lets us ask Google one question: when are you busy? The permission we request
          can&apos;t return event titles, guests, or locations, so we never see them. We keep the answer and an
          encrypted key that lets us ask again.
        </p>
        <p>
          While you&apos;re signed out, the create form runs Google&apos;s reCAPTCHA to keep bots from filling the site
          with junk polls, and Google may use what it observes to improve reCAPTCHA. Sign in first and reCAPTCHA never
          runs.
        </p>
        <p>What we get from Google signs you in and marks you busy. Nothing else, and nobody else.</p>
        {/*
          Google's OAuth reviewers look for this sentence close to verbatim -- it is the affirmative Limited Use
          statement their policy requires, not our own phrasing. Rewriting it to match the plainer voice of the rest of
          this page is what would fail the app's sensitive-scope verification, so leave the wording alone.
        */}
        <p>
          Pick a Time&apos;s use and transfer of information received from Google APIs to any other app will adhere to
          the{' '}
          <Link
            className="text-[var(--accent)] underline hover:text-[var(--accent-soft)]"
            href="https://developers.google.com/terms/api-services-user-data-policy"
          >
            Google API Services User Data Policy
          </Link>
          , including the Limited Use requirements.
        </p>
        <p>
          Disconnect your calendar whenever you like, from the menu under your name, or revoke our access from your{' '}
          <Link
            className="text-[var(--accent)] underline hover:text-[var(--accent-soft)]"
            href="https://myaccount.google.com/permissions"
          >
            Google account permissions page
          </Link>
          .
        </p>
      </Section>

      <Section title="How Long We Keep It">
        <p>
          A poll and everything in it disappears 14 days after the poll is created, whether or not the group ever picked
          a time.
        </p>
        <p>
          Your calendar connection outlives the poll. We keep it, and the busy times we&apos;ve saved, for 90 days after
          the last time we checked, and every check restarts that clock. Disconnect and both go immediately — though
          hours we already marked busy stay busy, and you can mark yourself free again at any time.
        </p>
        <p>If you signed in with Google, the record that lets us recognize you stays until you ask us to delete it.</p>
      </Section>

      <Section title="Your Rights">
        <p>
          Email{' '}
          <Link
            className="text-[var(--accent)] underline hover:text-[var(--accent-soft)]"
            href="mailto:privacy@dbowland.com"
          >
            privacy@dbowland.com
          </Link>{' '}
          to see, correct, or delete your data, or to ask anything else about this page.
        </p>
        <p>
          Pick a Time is meant for people 13 and older. If we change how we handle your data, we&apos;ll change this
          page and the date below.
        </p>
      </Section>

      <div className="flex items-center justify-between border-t border-[var(--hair)] pt-6 text-sm text-[var(--slate)]">
        <Link className="flex items-center gap-1 hover:text-[var(--bone)]" href="/">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
          Back to Pick a Time
        </Link>
        <span>Last updated August 11, 2026</span>
      </div>
    </div>
  )
}

export default PrivacyPolicy

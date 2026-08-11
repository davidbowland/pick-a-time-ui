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
          Pick a Time runs on two facts about you: the name you type and the hours you say you&apos;re free. We collect
          little else, everything deletes itself on the schedule below, and we never sell any of it.
        </p>
      </div>

      <Section title="Who Else Can See Your Hours">
        <p>
          Anyone with a poll&apos;s link or QR code can open it and read every participant&apos;s name and free hours,
          yours included. They don&apos;t have to join first, and we can&apos;t tell them from the people you meant to
          invite — a poll is guarded by its link and nothing else. Share the link the way you&apos;d share what&apos;s
          on it.
        </p>
        <p>
          They see your name and your hours. They never see your email address or which Google account you signed in
          with.
        </p>
        <p>
          If you connect your calendar, the hours it blocks off look exactly like hours you crossed out by hand. Nobody
          on the poll can tell which is which.
        </p>
      </Section>

      <Section title="What We Know About You">
        <p>
          Join a poll and we store the name you type and the hours you mark. That is all the app needs — no account, no
          email address, no password.
        </p>
        <p>
          Sign in with Google, which is optional, and we also store your name, your email address, and Google&apos;s
          identifier for your account, so we can recognize you next time and on your other devices.
        </p>
        <p>
          Every request your browser makes to our server leaves a line in a log: your IP address, what you asked for,
          and when. We read those lines when something breaks. We don&apos;t log which pages you read — the site itself
          keeps no visitor log at all.
        </p>
        <p>
          We set one cookie, and only once you&apos;ve joined a poll. It remembers which participant you are, works on
          that poll and no other, and expires in 14 days along with the poll. Your browser also remembers a few small
          things on its own so the site can pick up where you left off. None of it follows you to other sites.
        </p>
      </Section>

      <Section title="What Google Sees">
        <p>Signing in sends Google enough to vouch for you, which Google does under its own privacy policy.</p>
        <p>
          Connecting your calendar lets us ask Google one question: when are you busy? The permission we request
          can&apos;t return event titles, guests, or locations, so we never see them. We ask about the dates in your
          polls and nothing else — the poll&apos;s name and the other people on it never reach Google. We keep the
          answer, and we keep an encrypted key that lets us ask again without sending you back to Google every time.
        </p>
        <p>
          Making a poll while signed out runs Google&apos;s reCAPTCHA in the background, which is what keeps bots from
          filling the site with junk polls. It starts watching as soon as you begin filling the form in, not when you
          press create, and Google may use what it observes to improve reCAPTCHA and security generally. Sign in first
          and reCAPTCHA never runs at all.
        </p>
        <p>
          Everything we get from Google does two jobs and no others: it recognizes you when you sign in, and it marks
          you busy where your calendar says you&apos;re booked. Nothing else, and nobody else.
        </p>
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
          Disconnect your calendar whenever you like, from the menu under your name. You can also revoke our access from
          your{' '}
          <Link
            className="text-[var(--accent)] underline hover:text-[var(--accent-soft)]"
            href="https://myaccount.google.com/permissions"
          >
            Google account permissions page
          </Link>
          , which cuts us off at Google&apos;s end whether or not you disconnect here.
        </p>
      </Section>

      <Section title="How Long We Keep It">
        <p>
          A poll and everything in it — its dates, its participants, their names, everybody&apos;s hours — disappears 14
          days after the poll is created. That happens on its own, whether or not the group ever picked a time, and no
          matter how far off the poll&apos;s dates are.
        </p>
        <p>Server logs last 30 days.</p>
        <p>
          Your calendar connection belongs to your Google account rather than to any one poll, so it outlives the poll.
          We keep it for 90 days after the last time we checked your calendar, and every check restarts that clock. The
          busy times we&apos;ve saved cover the combined date range of every poll you&apos;re in, not just the one you
          connected from.
        </p>
        <p>
          Disconnect and both the key and the saved busy times go immediately. The hours we already marked busy stay
          busy on your polls — they&apos;re part of your availability now, and you can mark yourself free again at any
          time.
        </p>
        <p>
          If you signed in with Google, the record that lets us recognize you stays until you ask us to delete it. It
          isn&apos;t tied to a poll and doesn&apos;t expire with one.
        </p>
      </Section>

      <Section title="What We Never Do">
        <p>
          We don&apos;t sell your data, hand it to advertisers, build a profile of you, or use any of it for marketing.
        </p>
        <p>
          The only outside company that touches it is the one running the machinery: Amazon Web Services stores
          everything described here, and its Cognito service runs the Google sign-in. Past that we hand over nothing
          unless the law compels us — a valid court order, say.
        </p>
      </Section>

      <Section title="Your Rights">
        <p>
          Where you live may give you legal rights over your personal data — to see it, correct it, or have it deleted.
          Email{' '}
          <Link
            className="text-[var(--accent)] underline hover:text-[var(--accent-soft)]"
            href="mailto:privacy@dbowland.com"
          >
            privacy@dbowland.com
          </Link>{' '}
          and we&apos;ll take care of it. Same address for any other question about this page.
        </p>
      </Section>

      <Section title="Age and Changes">
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
        <span>Effective August 1, 2026</span>
      </div>
    </div>
  )
}

export default PrivacyPolicy

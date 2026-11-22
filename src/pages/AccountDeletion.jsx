// Account Deletion — public page at /account-deletion. Linked from the
// site footer and required by Google Play Data safety (Step 2 asks for this
// page's URL). Mirrors the in-app DeleteAccount flow exactly: same
// type-DELETE confirmation, same in-flight protections, same anonymisation
// of settled matches.
import { Link } from 'react-router-dom';
import LegalPage, { LegalList, LegalSection } from '@/components/LegalPage';

const CONTACT = 'mineyoursolutions@gmail.com';

export default function AccountDeletion() {
  return (
    <LegalPage
      eyebrow="Leaving the corner?"
      title="Delete Your Account"
      intro="You can delete your BetThat account at any time. This page explains how to do it in the app, what gets removed, what is kept in anonymised form, and what the in-app flow cannot remove on its own."
      updated="November 22, 2026"
    >
      <LegalSection title="How to delete your account in the app">
        <p>Deletion is done inside the app — it takes under a minute:</p>
        <LegalList
          items={[
            'Sign in to your BetThat account.',
            'Open the account menu in the top bar, or go to your Player Dashboard — both have a “Delete account” button.',
            'Read what will be removed, then type DELETE in the confirmation box to confirm.',
            'Tap “Delete my account”. You will be signed out immediately.',
          ]}
        />
        <p>
          If you cannot sign in, email{' '}
          <a className="font-semibold text-primary underline-offset-4 hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{' '}
          from the email address on your account and ask for the account to be deleted.
        </p>
      </LegalSection>

      <LegalSection title="What gets deleted">
        <p>Deleting your account permanently removes:</p>
        <LegalList
          items={[
            'Your profile, player card and wallets.',
            'Wagers and matches you created, your pitches and contracts.',
            'Your messages, chat and trash talk.',
          ]}
        />
        <p>
          Settled matches that involved other players are kept only as anonymised records (shown as
          &ldquo;Deleted player&rdquo;), so their results stay verifiable for the other side. Nothing
          else is kept in a form that identifies you.
        </p>
      </LegalSection>

      <LegalSection title="When deletion is refused">
        <p>
          Deletion is blocked while anything is still in flight, so no money or open wager is lost.
          The app will tell you exactly what is still open. You will need to settle or withdraw
          first if you have:
        </p>
        <LegalList
          items={[
            'Funds locked in escrow.',
            'A positive wallet balance — withdraw it first.',
            'Open or locked wagers.',
            'An open, matched or in-play match.',
            'An open console room.',
            'Open or locked prop bets.',
          ]}
        />
      </LegalSection>

      <LegalSection title="What the in-app flow does not remove">
        <p>
          The in-app flow removes your BetThat app data. Your underlying platform sign-in identity
          (the Base44 identity used to sign in) cannot be erased from inside the app. To remove that
          as well, after deleting your account in the app, email{' '}
          <a className="font-semibold text-primary underline-offset-4 hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{' '}
          from the email address on your account and ask for the underlying identity to be removed.
        </p>
      </LegalSection>

      <LegalSection title="Deletion is permanent">
        <p>
          Account deletion cannot be undone. Your username, history and balances are gone for good,
          and a deleted username cannot be recovered. If you think you might come back, withdraw your
          funds and simply stop using the app instead — you can delete the account later.
        </p>
        <p>
          For questions about your data, see the{' '}
          <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/privacy">
            Privacy Policy
          </Link>{' '}
          or email{' '}
          <a className="font-semibold text-primary underline-offset-4 hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}

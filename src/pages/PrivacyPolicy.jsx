// Privacy Policy — public page at /privacy. Linked from the site footer
// and required by Google Play Data safety. Plain, honest wording: nothing
// here invents a practice the app does not follow.
import LegalPage, { LegalList, LegalSection } from '@/components/LegalPage';

const CONTACT = 'mineyoursolutions@gmail.com';

export default function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrow="The fine print"
      title="Privacy Policy"
      intro="BetThat is a head-to-head gaming wager platform for players 18 and over. This policy explains what we collect when you use BetThat, why we collect it, who it is shared with, and the choices you have over your data."
      updated="November 22, 2026"
    >
      <LegalSection title="1. Who we are">
        <p>
          BetThat (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the BetThat app at betthat1000.base44.app.
          Questions about this policy or your data can be sent to{' '}
          <a className="font-semibold text-primary underline-offset-4 hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <p>We collect only what the app needs to run wagers, hold escrow and pay winners:</p>
        <LegalList
          items={[
            'Account details — your username, email address and password (or your Google account details when you sign in with Google).',
            'Wager and match history — the matches you create or join, the stakes you place, results, and the public ledger of settled wagers.',
            'Wallet and payment information — your crypto wallet addresses and balances in BTC, USDT, USDC and ETH, and the deposit and payout records needed to move funds in and out of escrow.',
            'Messages and match content — chat, trash talk and proof you post in match threads, and any messages you send to support.',
            'Device and usage data — basic technical information such as device type, app version and pages visited, used to keep the app working and to spot abuse.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. How we use your data">
        <LegalList
          items={[
            'Running wagers — creating and settling matches, holding stakes in escrow and releasing payouts to winners.',
            'Fraud prevention and fair play — verifying match results, checking for duplicate or abusive accounts, and enforcing the 18+ age requirement.',
            'Support — answering your questions and resolving disputes about a wager or payout.',
            'Improving the app — understanding which games and features players use, in aggregate where possible.',
          ]}
        />
        <p>We do not use your data for advertising, and we do not sell your personal data to anyone.</p>
      </LegalSection>

      <LegalSection title="4. What we share">
        <p>
          Your data is shared only where the app cannot work without it: with the crypto payment
          processors and wallet services that move funds in and out of escrow, and with the operator
          who verifies results and releases payouts. Match results and the open ledger of settled
          wagers are visible to other players by design — that is how payouts stay verifiable. We do
          not sell personal data, and we do not share it with advertisers or data brokers.
        </p>
        <p>
          We may also disclose data if the law requires it, or to protect the safety of players and
          the platform.
        </p>
      </LegalSection>

      <LegalSection title="5. Data retention">
        <p>
          We keep your account data while your account is active. Settled wager records are kept so
          past results stay verifiable; when you delete your account, those records are anonymised
          (shown as &ldquo;Deleted player&rdquo;) instead of being linked to you. See the{' '}
          <a className="font-semibold text-primary underline-offset-4 hover:underline" href="/account-deletion">
            Account Deletion page
          </a>{' '}
          for exactly what is removed. Data we no longer need is deleted or anonymised.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies and local storage">
        <p>
          The app uses browser local storage and cookies to keep you signed in, remember your
          preferences (such as theme) and keep the app secure. We do not use third-party advertising
          cookies. Clearing your browser data will sign you out.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>
          You can ask us to access, correct or delete the personal data we hold about you. The
          fastest way to delete your data is the in-app account deletion flow (see the Account
          Deletion page). For any other request, email{' '}
          <a className="font-semibold text-primary underline-offset-4 hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{' '}
          from the email address on your account and we will respond. Depending on where you live,
          you may also have the right to complain to your local data-protection authority.
        </p>
      </LegalSection>

      <LegalSection title="8. Age requirement">
        <p>
          BetThat is for players aged 18 and over only. We do not knowingly collect data from anyone
          under 18. If you believe a minor has created an account, contact us and we will remove it.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          Data is encrypted in transit. Access to account and payment data is limited to what is
          needed to run wagers and support players. No system is completely secure, so keep your
          password private and enable any extra sign-in protection the app offers.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to this policy">
        <p>
          If we change how we collect or use your data, we will update this page and change the
          &ldquo;Last updated&rdquo; date above. Continued use of the app after a change means you
          accept the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          BetThat —{' '}
          <a className="font-semibold text-primary underline-offset-4 hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}

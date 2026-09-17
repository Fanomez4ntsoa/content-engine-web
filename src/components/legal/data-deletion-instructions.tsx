import { CONTACT_EMAIL } from './contact'

export const THREADS_WEBSITE_PERMISSIONS_URL = 'https://www.threads.com/settings/website_permissions'

/** Texte de docs/pages-legales.md (page 2), `[APP_URL]` remplacé par l'URL de l'app. */
export function DataDeletionInstructions({ appUrl }: { appUrl: string }) {
  return (
    <article className="prose">
      <h1>Data Deletion Instructions — Content Engine Listening</h1>
      <p>
        Content Engine Listening does not permanently store any personal data about the people who log in. Your login
        information is kept only in a session cookie and disappears when you log out.
      </p>

      <h2>Remove the app&apos;s access</h2>
      <ol>
        <li>
          Open Threads and go to your website permissions:{' '}
          <a href={THREADS_WEBSITE_PERMISSIONS_URL} target="_blank" rel="noopener noreferrer">
            {THREADS_WEBSITE_PERMISSIONS_URL}
          </a>{' '}
          (or Settings → More settings → Website permissions).
        </li>
        <li>
          In the <strong>Active</strong> tab, find <strong>Content Engine Listening</strong>.
        </li>
        <li>
          Tap <strong>Remove</strong>.
        </li>
      </ol>

      <h2>Ask for deletion of any remaining data</h2>
      <p>
        If you believe the app holds data about you (for example, one of your public posts collected in the last 7 days),
        send an email to:
      </p>
      <p>
        <strong>{CONTACT_EMAIL}</strong>
      </p>
      <p>
        with the subject <strong>&quot;Data deletion request&quot;</strong> and your Threads username. Your data will be
        deleted and you will receive a confirmation within 30 days.
      </p>

      <h2>Automatic deletion</h2>
      <p>
        When you remove the app from your Threads settings, Meta notifies the web app automatically. The web app stores no
        data linked to your account, so there is nothing else to delete. The listening worker is a separate tool that does
        not receive these notifications and is not connected to the web app: public posts it collects are deleted
        automatically after 7 days, or sooner on request at the address above. You can check the status of a request at:
      </p>
      <p>
        <code>{appUrl}/data-deletion/status?code=YOUR_CONFIRMATION_CODE</code>
      </p>
    </article>
  )
}

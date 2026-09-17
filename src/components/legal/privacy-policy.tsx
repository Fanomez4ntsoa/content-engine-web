import { CONTACT_EMAIL } from './contact'

/** Texte de docs/pages-legales.md (page 1), `[APP_URL]` remplacé par l'URL de l'app. */
export function PrivacyPolicy({ appUrl }: { appUrl: string }) {
  return (
    <article className="prose">
      <h1>Privacy Policy — Content Engine Listening</h1>
      <p>
        <em>Last updated: September 2026</em>
      </p>

      <h2>1. Who I am</h2>
      <p>
        Content Engine Listening (&quot;the app&quot;) is a personal tool built and operated by Fanomezantsoa Voary, an
        independent developer based in Madagascar.
      </p>
      <p>
        The app is used to help the brand <strong>La Plateforme du Portable</strong> (a French community and marketplace
        about mobile phones) find public conversations on Threads, so that a human can reply to them manually.
      </p>
      <p>
        Contact: <strong>{CONTACT_EMAIL}</strong>
      </p>

      <h2>2. What the app does — and does not do</h2>
      <p>
        The app searches recent <strong>public</strong> Threads posts that match keywords related to mobile phones, and
        displays them to the logged-in user. On the web app, the keyword is typed by the logged-in user; the listening
        worker uses a short list of French keywords.
      </p>
      <p>
        The app <strong>never</strong> publishes, replies, likes, follows or sends messages. It does not request any
        permission that would allow it to do so. Every reply is written and posted by a person, by hand, directly on
        Threads.
      </p>

      <h2>3. Data I collect</h2>
      <p>
        <strong>When you log in with Threads</strong>, the app receives:
      </p>
      <ul>
        <li>your Threads user ID and username;</li>
        <li>an access token that allows the app to run keyword searches on your behalf.</li>
      </ul>
      <p>
        <strong>When a search is run</strong>, the Threads API returns public posts: post ID, text, author username,
        publication date and link to the post.
      </p>
      <p>
        The app does <strong>not</strong> collect your email address, your password, your private messages, your
        followers or any non-public content.
      </p>

      <h2>4. How the data is used and stored</h2>
      <p>
        <strong>Web app ({appUrl})</strong>
      </p>
      <ul>
        <li>
          Your user ID, username and access token are kept only in an encrypted session cookie, for the duration of your
          session. They are removed when you log out or when the session expires.
        </li>
        <li>
          Search results are displayed on screen and are <strong>not stored</strong>.
        </li>
      </ul>
      <p>
        <strong>Listening worker (run locally by the developer)</strong>
      </p>
      <ul>
        <li>
          A background tool, run on the developer&apos;s own computer, uses the developer&apos;s own Threads account to
          run the same keyword searches.
        </li>
        <li>
          Matching public posts are stored locally for <strong>7 days maximum</strong>, only to avoid showing the same post
          twice, then automatically deleted.
        </li>
        <li>
          Posts may be analyzed by a language model running <strong>locally</strong> on the same computer, to estimate their
          relevance. No data is sent to an external AI service.
        </li>
      </ul>

      <h2>5. Sharing</h2>
      <p>
        Data is <strong>never sold, rented or shared</strong> with third parties, and is never used for advertising,
        profiling or training AI models.
      </p>
      <p>The app relies on the following services, strictly to function:</p>
      <ul>
        <li>
          <strong>Meta (Threads API)</strong> — login and search;
        </li>
        <li>
          <strong>Vercel</strong> — hosting of the web app (standard technical logs, such as IP address, request time and
          requested URL, may be kept by the host for security purposes). A requested URL can contain the one-time
          authorization code sent by Threads at login; this code is short-lived and can only be used once.
        </li>
      </ul>

      <h2>6. Your rights</h2>
      <p>You can at any time:</p>
      <ul>
        <li>
          revoke the app&apos;s access to your Threads account (see the <a href="/data-deletion">Data Deletion page</a>);
        </li>
        <li>ask what data concerning you is held, and ask for its deletion, by writing to the contact address above.</li>
      </ul>
      <p>
        If you are located in the European Union, you have the rights granted by the GDPR (access, rectification, erasure,
        objection). Requests are answered within 30 days.
      </p>

      <h2>7. Children</h2>
      <p>The app is not intended for people under 18.</p>

      <h2>8. Changes</h2>
      <p>This policy may be updated. The date at the top of this page shows the latest version.</p>
    </article>
  )
}

# Content Engine Web — Pages légales

> Deux pages à intégrer dans `content-engine-web` :
> - `/privacy` → Privacy Policy
> - `/data-deletion` → Data Deletion Instructions
>
> Remplacer `[APP_URL]` par l'URL Vercel avant publication.
> Contact : voary.fanomezantsoa+threadsapp@gmail.com

---

## PAGE 1 — `/privacy`

# Privacy Policy — Content Engine Listening

*Last updated: September 2026*

## 1. Who I am

Content Engine Listening ("the app") is a personal tool built and operated by Fanomezantsoa Voary, an independent developer based in Madagascar.

The app is used to help the brand **La Plateforme du Portable** (a French community and marketplace about mobile phones) find public conversations on Threads, so that a human can reply to them manually.

Contact: **voary.fanomezantsoa+threadsapp@gmail.com**

## 2. What the app does — and does not do

The app searches recent **public** Threads posts that match keywords related to mobile phones, and displays them to the logged-in user. On the web app, the keyword is typed by the logged-in user; the listening worker uses a short list of French keywords.

The app **never** publishes, replies, likes, follows or sends messages. It does not request any permission that would allow it to do so. Every reply is written and posted by a person, by hand, directly on Threads.

## 3. Data I collect

**When you log in with Threads**, the app receives:
- your Threads user ID and username;
- an access token that allows the app to run keyword searches on your behalf.

**When a search is run**, the Threads API returns public posts: post ID, text, author username, publication date and link to the post.

The app does **not** collect your email address, your password, your private messages, your followers or any non-public content.

## 4. How the data is used and stored

**Web app ([APP_URL])**
- Your user ID, username and access token are kept only in an encrypted session cookie, for the duration of your session. They are removed when you log out or when the session expires.
- Search results are displayed on screen and are **not stored**.

**Listening worker (run locally by the developer)**
- A background tool, run on the developer's own computer, uses the developer's own Threads account to run the same keyword searches.
- Matching public posts are stored locally for **7 days maximum**, only to avoid showing the same post twice, then automatically deleted.
- Posts may be analyzed by a language model running **locally** on the same computer, to estimate their relevance. No data is sent to an external AI service.

## 5. Sharing

Data is **never sold, rented or shared** with third parties, and is never used for advertising, profiling or training AI models.

The app relies on the following services, strictly to function:
- **Meta (Threads API)** — login and search;
- **Vercel** — hosting of the web app (standard technical logs, such as IP address, request time and requested URL, may be kept by the host for security purposes). A requested URL can contain the one-time authorization code sent by Threads at login; this code is short-lived and can only be used once.

## 6. Your rights

You can at any time:
- revoke the app's access to your Threads account (see the Data Deletion page);
- ask what data concerning you is held, and ask for its deletion, by writing to the contact address above.

If you are located in the European Union, you have the rights granted by the GDPR (access, rectification, erasure, objection). Requests are answered within 30 days.

## 7. Children

The app is not intended for people under 18.

## 8. Changes

This policy may be updated. The date at the top of this page shows the latest version.

---

## PAGE 2 — `/data-deletion`

# Data Deletion Instructions — Content Engine Listening

Content Engine Listening does not permanently store any personal data about the people who log in. Your login information is kept only in a session cookie and disappears when you log out.

## Remove the app's access

1. Open Threads and go to your website permissions:
   [https://www.threads.com/settings/website_permissions](https://www.threads.com/settings/website_permissions)
   (or Settings → More settings → Website permissions).
2. In the **Active** tab, find **Content Engine Listening**.
3. Tap **Remove**.

## Ask for deletion of any remaining data

If you believe the app holds data about you (for example, one of your public posts collected in the last 7 days), send an email to:

**voary.fanomezantsoa+threadsapp@gmail.com**

with the subject **"Data deletion request"** and your Threads username. Your data will be deleted and you will receive a confirmation within 30 days.

## Automatic deletion

When you remove the app from your Threads settings, Meta notifies the web app automatically. The web app stores no data linked to your account, so there is nothing else to delete. The listening worker is a separate tool that does not receive these notifications and is not connected to the web app: public posts it collects are deleted automatically after 7 days, or sooner on request at the address above. You can check the status of a request at:

`[APP_URL]/data-deletion/status?code=YOUR_CONFIRMATION_CODE`

---

## Notes d'implémentation

- **Delete Callback URL** (`/api/threads/delete`) : Meta envoie un `signed_request` en POST. Il faut vérifier la signature avec le Threads App Secret, puis répondre en JSON : `{ "url": "[APP_URL]/data-deletion/status?code=XXX", "confirmation_code": "XXX" }`.
- **Uninstall Callback URL** (`/api/threads/uninstall`) : même `signed_request`, il suffit de vérifier et de répondre `200`.
- La page de statut peut rester simple : « Your request has been processed. This web app stores no data linked to your account. »
- Le texte promet une session chiffrée et aucun stockage de posts côté web : l'implémentation doit s'y tenir exactement.
- Le collecteur local doit réellement purger les posts de plus de 7 jours (tâche de nettoyage à chaque cycle).

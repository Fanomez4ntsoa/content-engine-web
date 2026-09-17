import { isConfirmationCode } from '@/lib/confirmation-code'

/** Un code invalide n'est jamais réaffiché. */
export function DeletionStatus({ code }: { code: unknown }) {
  if (!isConfirmationCode(code)) {
    return (
      <article className="prose">
        <h1>Deletion request status</h1>
        <p className="notice">This status link is not valid.</p>
        <p>
          See the <a href="/data-deletion">Data Deletion Instructions</a> to remove the app&apos;s access to your Threads
          account.
        </p>
      </article>
    )
  }

  return (
    <article className="prose">
      <h1>Deletion request status</h1>
      <p className="notice">Your request has been processed. This web app stores no data linked to your account.</p>
      <p>
        Confirmation code: <code>{code}</code>
      </p>
    </article>
  )
}

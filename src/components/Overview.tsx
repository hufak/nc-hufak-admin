import type { ReactElement } from "react";
import { styles } from "../styles";

function Overview(): ReactElement {
  return (
    <section style={styles.formSection}>
      <h2>Hufak account configuration</h2>
      <ul style={styles.overviewList}>
        <li>
          <strong>account overview</strong>: inspect Nextcloud accounts, mailbox state,
          identities, activity, and app-order drift in one place.
        </li>
        <li>
          <strong>create new</strong>: create a Nextcloud account, generate
          credentials, and optionally configure the primary mailbox immediately.
        </li>
        <li>
          <strong>configure mail</strong>: set an account's primary SnappyMail
          account.
        </li>
        <li>
          <strong>shared mailboxes</strong>: edit the hierarchical shared
          mailbox config (`shared_mailboxes`).
        </li>
        <li>
          <strong>signature template</strong>: edit the shared Hufak signature
          template with a live preview.
        </li>
        <li>
          <strong>nextcloud app order</strong>: edit and validate the global
          default app-order JSON before saving it.
        </li>
      </ul>
    </section>
  );
}

export { Overview };

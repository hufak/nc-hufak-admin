import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { apiRequest } from "../api";
import { formatTimeSince, isInactiveOverMonth } from "../utils/timeUtils";
import { styles } from "../styles";
import { AccountEmailAccountsOverview } from "./AccountEmailAccountsOverview";
import type { DisabledUser, MailboxUser, UserStatusResponse } from "../types";

interface AccountOverviewProps {
  onEditMailbox?: (uid: string) => void;
}

function AccountOverview({
  onEditMailbox,
}: AccountOverviewProps): ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<MailboxUser[]>([]);
  const [disabledUsers, setDisabledUsers] = useState<DisabledUser[]>([]);
  const [diffUid, setDiffUid] = useState("");
  const [resettingUid, setResettingUid] = useState("");
  const [promotingUid, setPromotingUid] = useState("");
  const [promoteConfirmUid, setPromoteConfirmUid] = useState("");

  const loadUserStatus = useCallback(async () => {
    try {
      const data = await apiRequest<UserStatusResponse>(
        OC.generateUrl("/apps/hufak/api/accounts/status"),
      );
      const nextUsers = Array.isArray(data.users) ? data.users : [];
      nextUsers.forEach((user) => {
        if (user?.identitiesLookupError) {
          console.warn(
            `[hufak] identities lookup failed for ${user.uid || "unknown"}:`,
            user.identitiesLookupError,
          );
        }
        if (user?.additionalAccountIdentitiesLookupErrors) {
          Object.entries(user.additionalAccountIdentitiesLookupErrors).forEach(
            ([account, message]) => {
              console.warn(
                `[hufak] additional account identities lookup failed for ${user.uid || "unknown"} (${account}):`,
                message,
              );
            },
          );
        }
      });
      setUsers(nextUsers);
      setDisabledUsers(
        Array.isArray(data.disabledUsers) ? data.disabledUsers : [],
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserStatus();
  }, [loadUserStatus]);

  const resetUserApporder = async (uid: string) => {
    setResettingUid(uid);
    try {
      await apiRequest(
        OC.generateUrl(
          `/apps/hufak/api/accounts/${encodeURIComponent(uid)}/apporder/default`,
        ),
        {
          method: "POST",
        },
      );
      await loadUserStatus();
    } catch (err) {
      setError(
        `Failed to reset app order for ${uid}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setResettingUid("");
    }
  };

  const promoteUserApporder = async (uid: string) => {
    setPromoteConfirmUid("");
    setPromotingUid(uid);
    try {
      await apiRequest(
        OC.generateUrl(
          `/apps/hufak/api/accounts/${encodeURIComponent(uid)}/apporder/promote`,
        ),
        {
          method: "POST",
        },
      );
      await loadUserStatus();
    } catch (err) {
      setError(
        `Failed to set default app order from ${uid}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setPromotingUid("");
    }
  };

  if (loading) {
    return (
      <section style={styles.formSection}>
        <div style={styles.proseContent}>
          <h2>Account overview</h2>
          <p>Loading account status...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section style={styles.formSection}>
        <div style={styles.proseContent}>
          <h2>Account overview</h2>
          <p style={styles.validationMessage}>Failed to load status: {error}</p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.fullWidthSection}>
      {promoteConfirmUid && (
        <div
          style={styles.modalBackdrop}
          onMouseDown={() => setPromoteConfirmUid("")}
          role="presentation"
        >
          <div
            style={styles.modalCard}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h4 style={styles.modalTitle}>Set new default app order</h4>
            <p style={styles.modalText}>
              Store the app order of <strong>{promoteConfirmUid}</strong> as the
              new global default app order? It will be used for newly created
              accounts and when resetting other accounts' app order.
            </p>
            <div style={styles.modalButtonRow}>
              <button
                type="button"
                onClick={() => promoteUserApporder(promoteConfirmUid)}
                style={styles.submitButton}
              >
                Set as default
              </button>
              <button
                type="button"
                onClick={() => setPromoteConfirmUid("")}
                style={styles.clearButton}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={styles.proseSectionContent}>
        <h2>Account overview</h2>
        <p style={styles.introText}>
          Hufak-specific Nextcloud account and Snappymail email settings
          overview and quick-edit. To deactive and delete old accounts, use{" "}
          <a href={OC.generateUrl("/settings/users")} style={styles.inlineLink}>
            Nextcloud account management
          </a>
          .
        </p>
      </div>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>UID</th>
              <th style={styles.tableHeader}>Snappymail email accounts</th>
              <th style={styles.tableHeader}>NC app order</th>
              <th style={styles.tableHeader}>Last activity</th>
              <th style={styles.tableHeader}>Failed login attempts</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isApporderMismatch = !user.apporderMatches;
              return (
                <tr key={user.uid}>
                  <td style={styles.tableCell}>{user.uid}</td>
                  <td style={{ ...styles.tableCell, ...styles.emailCell }}>
                    <div style={styles.emailCellLayout}>
                      <div style={styles.emailCellContent}>
                        <AccountEmailAccountsOverview user={user} />
                      </div>
                      {onEditMailbox ? (
                        <button
                          type="button"
                          onClick={() => onEditMailbox(user.uid)}
                          style={styles.emailCellEditButton}
                          title={`edit Snappymail accounts for user ${user.uid}`}
                          aria-label={`edit Snappymail accounts for user ${user.uid}`}
                        >
                          <span
                            className="icon icon-rename"
                            aria-hidden="true"
                            style={styles.squareIcon}
                          />
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.statusWithTooltip}>
                      {user.apporderMatches ? (
                        <span
                          className="icon icon-checkmark"
                          aria-label="app order matches default"
                        ></span>
                      ) : (
                        <>
                          <span
                            className="icon icon-error"
                            aria-label="app order differs from default"
                          ></span>
                          <button
                            type="button"
                            onClick={() =>
                              setDiffUid(diffUid === user.uid ? "" : user.uid)
                            }
                            style={styles.inlineActionButton}
                            aria-expanded={diffUid === user.uid}
                            aria-label="inspect difference to default app order"
                            title="inspect difference to default app order"
                          >
                            <span
                              className="icon icon-toggle"
                              aria-hidden="true"
                              style={styles.squareIcon}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => resetUserApporder(user.uid)}
                            disabled={
                              resettingUid === user.uid ||
                              promotingUid === user.uid
                            }
                            style={styles.inlineActionButton}
                            aria-label="apply default app order"
                            title="apply default app order"
                          >
                            <span
                              className={`icon ${resettingUid === user.uid ? "icon-loading-small" : "icon-history"}`}
                              aria-hidden="true"
                              style={styles.squareIcon}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPromoteConfirmUid(user.uid)}
                            disabled={
                              resettingUid === user.uid ||
                              promotingUid === user.uid
                            }
                            style={styles.inlineActionButton}
                            aria-label="set this user's app order as the new global default app order"
                            title="set this user's app order as the new global default app order"
                          >
                            <span
                              className={`icon ${promotingUid === user.uid ? "icon-loading-small" : "icon-upload"}`}
                              aria-hidden="true"
                              style={styles.squareIcon}
                            />
                          </button>
                        </>
                      )}
                      {isApporderMismatch && diffUid === user.uid && (
                        <div style={styles.tooltipPanel}>
                          <div style={styles.tooltipHeader}>
                            <strong>
                              App order diff: {user.uid} vs. default
                            </strong>
                            <button
                              type="button"
                              onClick={() => setDiffUid("")}
                              style={styles.inlineActionButton}
                              aria-label="close diff"
                              title="close diff"
                            >
                              <span
                                className="icon icon-close"
                                aria-hidden="true"
                                style={styles.squareIcon}
                              />
                            </button>
                          </div>
                          <p style={{ ...styles.hintText, marginBottom: "6px" }}>
                            <code>[user, default]</code> changed &middot;{" "}
                            <code>[user, 0, 0]</code> only in user app order
                            &middot; <code>[default]</code> only in default app
                            order
                          </p>
                          <pre style={styles.tooltipPre}>
                            {JSON.stringify(user.apporderDiff || {}, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <span>{formatTimeSince(user.lastActivityTs)}</span>
                    {user.lastActivityTs !== null &&
                      user.lastActivityTs !== undefined &&
                      Number(user.lastActivityTs) > 0 &&
                      isInactiveOverMonth(user.lastActivityTs) && (
                        <span
                          style={styles.inactiveWarning}
                          title="No activity for more than one month"
                        >
                          !
                        </span>
                      )}
                  </td>
                  <td style={styles.tableCell}>
                    {Number.isInteger(user.failedLoginAttempts)
                      ? user.failedLoginAttempts
                      : "-"}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td style={styles.tableCell} colSpan={5}>
                  No active accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={styles.proseSectionContent}>
        <h3 style={styles.subheading}>Disabled accounts</h3>
      </div>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>UID</th>
            </tr>
          </thead>
          <tbody>
            {disabledUsers.map((user) => (
              <tr key={`disabled-${user.uid}`}>
                <td style={styles.tableCell}>{user.uid}</td>
              </tr>
            ))}
            {disabledUsers.length === 0 && (
              <tr>
                <td style={styles.tableCell}>No disabled accounts found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export { AccountOverview };

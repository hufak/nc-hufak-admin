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

interface DiffPopoverState {
  uid: string;
  top: number;
  left: number;
  width: number;
}

interface ApporderRow {
  key: string;
  userValue?: string;
  defaultValue?: string;
  differs: boolean;
}

const POPOVER_MAX_WIDTH = 920;
const POPOVER_MARGIN = 8;

function parseApporder(raw: string | undefined): Record<string, unknown> | null {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function apporderEntryOrder(value: unknown): number {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const order = (value as Record<string, unknown>).order;
    if (typeof order === "number" && Number.isFinite(order)) {
      return order;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

function buildApporderRows(
  userApporder: Record<string, unknown>,
  defaultApporder: Record<string, unknown>,
): ApporderRow[] {
  const keys = Array.from(
    new Set([...Object.keys(userApporder), ...Object.keys(defaultApporder)]),
  );
  const rows = keys.map((key) => {
    const inUser = Object.prototype.hasOwnProperty.call(userApporder, key);
    const inDefault = Object.prototype.hasOwnProperty.call(defaultApporder, key);
    const userValue = inUser ? JSON.stringify(userApporder[key]) : undefined;
    const defaultValue = inDefault
      ? JSON.stringify(defaultApporder[key])
      : undefined;
    return {
      key,
      userValue,
      defaultValue,
      differs: userValue !== defaultValue,
    };
  });

  return rows.sort((a, b) => {
    const orderA = Math.min(
      apporderEntryOrder(defaultApporder[a.key]),
      apporderEntryOrder(userApporder[a.key]),
    );
    const orderB = Math.min(
      apporderEntryOrder(defaultApporder[b.key]),
      apporderEntryOrder(userApporder[b.key]),
    );
    return orderA !== orderB ? orderA - orderB : a.key.localeCompare(b.key);
  });
}

function AccountOverview({
  onEditMailbox,
}: AccountOverviewProps): ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<MailboxUser[]>([]);
  const [disabledUsers, setDisabledUsers] = useState<DisabledUser[]>([]);
  const [defaultApporder, setDefaultApporder] = useState("");
  const [diffPopover, setDiffPopover] = useState<DiffPopoverState | null>(null);
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
      setDefaultApporder(
        typeof data.defaultApporder === "string" ? data.defaultApporder : "",
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

  useEffect(() => {
    if (!diffPopover) {
      return;
    }
    // the panel is positioned against the viewport, so any scroll or resize
    // would leave it detached from its trigger button
    const close = () => setDiffPopover(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [diffPopover]);

  const toggleDiffPopover = (uid: string, anchor: HTMLElement) => {
    if (diffPopover?.uid === uid) {
      setDiffPopover(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(
      POPOVER_MAX_WIDTH,
      window.innerWidth - 2 * POPOVER_MARGIN,
    );
    const left = Math.max(
      POPOVER_MARGIN,
      Math.min(rect.left, window.innerWidth - width - POPOVER_MARGIN),
    );
    setDiffPopover({ uid, top: rect.bottom + 6, left, width });
  };

  const resetUserApporder = async (uid: string) => {
    setDiffPopover(null);
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
    setDiffPopover(null);
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

  const diffUser = diffPopover
    ? users.find((user) => user.uid === diffPopover.uid)
    : undefined;
  const diffUserApporder = parseApporder(diffUser?.apporder);
  const diffDefaultApporder = parseApporder(defaultApporder);
  const diffRows =
    diffUserApporder && diffDefaultApporder
      ? buildApporderRows(diffUserApporder, diffDefaultApporder)
      : null;

  return (
    <section style={styles.fullWidthSection}>
      {diffPopover && diffUser && (
        <>
          <div
            style={styles.popoverBackdrop}
            onMouseDown={() => setDiffPopover(null)}
            role="presentation"
          />
          <div
            style={{
              ...styles.popoverPanel,
              top: `${diffPopover.top}px`,
              left: `${diffPopover.left}px`,
              width: `${diffPopover.width}px`,
              maxHeight: `calc(100vh - ${diffPopover.top + POPOVER_MARGIN}px)`,
            }}
          >
            <div style={styles.tooltipHeader}>
              <strong>App order of {diffUser.uid} vs. default app order</strong>
              <button
                type="button"
                onClick={() => setDiffPopover(null)}
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
            {diffRows ? (
              <>
                <p style={{ ...styles.hintText, marginBottom: "6px" }}>
                  Highlighted rows differ. Entries are sorted by app order
                  position.
                </p>
                <div style={styles.diffScroller}>
                  <table style={styles.diffTable}>
                    <thead>
                      <tr>
                        <th style={styles.diffTableHeader}>App</th>
                        <th style={styles.diffTableHeader}>
                          {diffUser.uid} (user)
                        </th>
                        <th style={styles.diffTableHeader}>default</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffRows.map((row) => (
                        <tr
                          key={row.key}
                          style={row.differs ? styles.diffRowChanged : undefined}
                        >
                          <td style={styles.diffTableCell}>{row.key}</td>
                          <td style={styles.diffTableCell}>
                            {row.userValue ?? "—"}
                          </td>
                          <td style={styles.diffTableCell}>
                            {row.defaultValue ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={styles.diffColumns}>
                <div>
                  <p style={{ ...styles.hintText, marginBottom: "4px" }}>
                    {diffUser.uid} (user)
                  </p>
                  <pre style={styles.tooltipPre}>
                    {diffUser.apporder || "(empty)"}
                  </pre>
                </div>
                <div>
                  <p style={{ ...styles.hintText, marginBottom: "4px" }}>
                    default
                  </p>
                  <pre style={styles.tooltipPre}>
                    {defaultApporder || "(empty)"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </>
      )}
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
                            onClick={(event) =>
                              toggleDiffPopover(user.uid, event.currentTarget)
                            }
                            style={styles.inlineActionButton}
                            aria-expanded={diffPopover?.uid === user.uid}
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

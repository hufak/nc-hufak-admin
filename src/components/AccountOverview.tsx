import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { apiRequest } from "../api";
import { formatTimeSince, isInactiveOverMonth } from "../utils/timeUtils";
import {
  buildSettingDiffRows,
  parseJsonObjectSetting,
  parseListSetting,
} from "../utils/settingDiff";
import { styles } from "../styles";
import { AccountEmailAccountsOverview } from "./AccountEmailAccountsOverview";
import { SettingDiffCell } from "./SettingDiffCell";
import { SettingDiffPopover } from "./SettingDiffPopover";
import type { DisabledUser, MailboxUser, UserStatusResponse } from "../types";

interface AccountOverviewProps {
  onEditMailbox?: (uid: string) => void;
}

type SettingKey = "apporder" | "dashboard";

interface SettingDefinition {
  key: SettingKey;
  /** used in button labels and messages */
  name: string;
  columnHeader: string;
  entryHeader: string;
  /** path segment of the per-account endpoints */
  endpoint: string;
  matches: (user: MailboxUser) => boolean;
  userValue: (user: MailboxUser) => string;
  parse: (raw: string | undefined) => Record<string, unknown> | null;
}

const SETTINGS: SettingDefinition[] = [
  {
    key: "apporder",
    name: "app order",
    columnHeader: "NC app order",
    entryHeader: "App",
    endpoint: "apporder",
    matches: (user) => Boolean(user.apporderMatches),
    userValue: (user) => user.apporder || "",
    parse: parseJsonObjectSetting,
  },
  {
    key: "dashboard",
    name: "dashboard widgets",
    columnHeader: "NC dashboard widgets",
    entryHeader: "Widget",
    endpoint: "dashboard-layout",
    matches: (user) => Boolean(user.dashboardLayoutMatches),
    userValue: (user) => user.dashboardLayout || "",
    parse: parseListSetting,
  },
];

interface DiffPopoverState {
  uid: string;
  settingKey: SettingKey;
  top: number;
  left: number;
  width: number;
}

interface PendingAction {
  uid: string;
  settingKey: SettingKey;
}

const POPOVER_MAX_WIDTH = 920;
const POPOVER_MARGIN = 8;

function isSameAction(
  action: PendingAction | null,
  uid: string,
  settingKey: SettingKey,
): boolean {
  return action?.uid === uid && action.settingKey === settingKey;
}

function AccountOverview({
  onEditMailbox,
}: AccountOverviewProps): ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<MailboxUser[]>([]);
  const [disabledUsers, setDisabledUsers] = useState<DisabledUser[]>([]);
  const [defaultApporder, setDefaultApporder] = useState("");
  const [defaultDashboardLayout, setDefaultDashboardLayout] = useState("");
  const [diffPopover, setDiffPopover] = useState<DiffPopoverState | null>(null);
  const [resetting, setResetting] = useState<PendingAction | null>(null);
  const [promoting, setPromoting] = useState<PendingAction | null>(null);
  const [promoteConfirm, setPromoteConfirm] = useState<PendingAction | null>(
    null,
  );

  const defaultValueFor = (settingKey: SettingKey): string =>
    settingKey === "apporder" ? defaultApporder : defaultDashboardLayout;

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
      setDefaultDashboardLayout(
        typeof data.defaultDashboardLayout === "string"
          ? data.defaultDashboardLayout
          : "",
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

  const toggleDiffPopover = (
    uid: string,
    settingKey: SettingKey,
    anchor: HTMLElement,
  ) => {
    if (diffPopover?.uid === uid && diffPopover.settingKey === settingKey) {
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
    setDiffPopover({
      uid,
      settingKey,
      top: rect.bottom + 6,
      left,
      width,
    });
  };

  const applyDefaultSetting = async (
    uid: string,
    setting: SettingDefinition,
  ) => {
    setDiffPopover(null);
    setResetting({ uid, settingKey: setting.key });
    try {
      await apiRequest(
        OC.generateUrl(
          `/apps/hufak/api/accounts/${encodeURIComponent(uid)}/${setting.endpoint}/default`,
        ),
        {
          method: "POST",
        },
      );
      await loadUserStatus();
    } catch (err) {
      setError(
        `Failed to reset ${setting.name} for ${uid}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setResetting(null);
    }
  };

  const promoteSettingToDefault = async (
    uid: string,
    setting: SettingDefinition,
  ) => {
    setDiffPopover(null);
    setPromoteConfirm(null);
    setPromoting({ uid, settingKey: setting.key });
    try {
      await apiRequest(
        OC.generateUrl(
          `/apps/hufak/api/accounts/${encodeURIComponent(uid)}/${setting.endpoint}/promote`,
        ),
        {
          method: "POST",
        },
      );
      await loadUserStatus();
    } catch (err) {
      setError(
        `Failed to set default ${setting.name} from ${uid}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setPromoting(null);
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

  const diffSetting = diffPopover
    ? SETTINGS.find((setting) => setting.key === diffPopover.settingKey)
    : undefined;
  const diffUser = diffPopover
    ? users.find((user) => user.uid === diffPopover.uid)
    : undefined;
  const diffUserRaw =
    diffSetting && diffUser ? diffSetting.userValue(diffUser) : "";
  const diffDefaultRaw = diffPopover ? defaultValueFor(diffPopover.settingKey) : "";
  const diffUserParsed = diffSetting ? diffSetting.parse(diffUserRaw) : null;
  const diffDefaultParsed = diffSetting ? diffSetting.parse(diffDefaultRaw) : null;
  const diffRows =
    diffUserParsed && diffDefaultParsed
      ? buildSettingDiffRows(diffUserParsed, diffDefaultParsed)
      : null;
  const promoteConfirmSetting = promoteConfirm
    ? SETTINGS.find((setting) => setting.key === promoteConfirm.settingKey)
    : undefined;

  return (
    <section style={styles.fullWidthSection}>
      {diffPopover && diffSetting && diffUser && (
        <SettingDiffPopover
          title={`${diffSetting.name} of ${diffUser.uid} vs. default ${diffSetting.name}`}
          entryHeader={diffSetting.entryHeader}
          userLabel={`${diffUser.uid} (user)`}
          rows={diffRows}
          userRaw={diffUserRaw}
          defaultRaw={diffDefaultRaw}
          top={diffPopover.top}
          left={diffPopover.left}
          width={diffPopover.width}
          margin={POPOVER_MARGIN}
          onClose={() => setDiffPopover(null)}
        />
      )}
      {promoteConfirm && promoteConfirmSetting && (
        <div
          style={styles.modalBackdrop}
          onMouseDown={() => setPromoteConfirm(null)}
          role="presentation"
        >
          <div
            style={styles.modalCard}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h4 style={styles.modalTitle}>
              Set new default {promoteConfirmSetting.name}
            </h4>
            <p style={styles.modalText}>
              Store the {promoteConfirmSetting.name} of{" "}
              <strong>{promoteConfirm.uid}</strong> as the new global default{" "}
              {promoteConfirmSetting.name}? It will be used for newly created
              accounts and when resetting other accounts.
            </p>
            <div style={styles.modalButtonRow}>
              <button
                type="button"
                onClick={() =>
                  promoteSettingToDefault(
                    promoteConfirm.uid,
                    promoteConfirmSetting,
                  )
                }
                style={styles.submitButton}
              >
                Set as default
              </button>
              <button
                type="button"
                onClick={() => setPromoteConfirm(null)}
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
          Hufak-specific Nextcloud account and NextSnapMail email settings
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
              <th style={styles.tableHeader}>NextSnapMail email accounts</th>
              {SETTINGS.map((setting) => (
                <th key={setting.key} style={styles.tableHeader}>
                  {setting.columnHeader}
                </th>
              ))}
              <th style={styles.tableHeader}>Last activity</th>
              <th style={styles.tableHeader}>Failed login attempts</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
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
                        title={`edit NextSnapMail accounts for user ${user.uid}`}
                        aria-label={`edit NextSnapMail accounts for user ${user.uid}`}
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
                {SETTINGS.map((setting) => {
                  const isResetting = isSameAction(
                    resetting,
                    user.uid,
                    setting.key,
                  );
                  const isPromoting = isSameAction(
                    promoting,
                    user.uid,
                    setting.key,
                  );
                  return (
                    <td key={setting.key} style={styles.tableCell}>
                      <div style={styles.statusWithTooltip}>
                        <SettingDiffCell
                          settingName={setting.name}
                          uid={user.uid}
                          matches={setting.matches(user)}
                          busy={isResetting || isPromoting}
                          applying={isResetting}
                          promoting={isPromoting}
                          inspectExpanded={
                            diffPopover?.uid === user.uid &&
                            diffPopover.settingKey === setting.key
                          }
                          onInspect={(anchor) =>
                            toggleDiffPopover(user.uid, setting.key, anchor)
                          }
                          onApplyDefault={() =>
                            applyDefaultSetting(user.uid, setting)
                          }
                          onPromoteToDefault={() =>
                            setPromoteConfirm({
                              uid: user.uid,
                              settingKey: setting.key,
                            })
                          }
                        />
                      </div>
                    </td>
                  );
                })}
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
            ))}
            {users.length === 0 && (
              <tr>
                <td style={styles.tableCell} colSpan={4 + SETTINGS.length}>
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

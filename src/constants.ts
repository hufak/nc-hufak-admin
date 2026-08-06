export type SectionKey =
  | "student-list"
  | "student-stats"
  | "overview"
  | "add-account"
  | "configure-mail"
  | "mailbox-names"
  | "account-overview"
  | "signature-template"
  | "app-order"
  | "dashboard-widgets";

const SECTION_KEYS = {
  STUDENT_LIST: "student-list",
  STUDENT_STATS: "student-stats",
  OVERVIEW: "overview",
  ADD_ACCOUNT: "add-account",
  CONFIGURE_MAIL: "configure-mail",
  MAILBOX_NAMES: "mailbox-names",
  ACCOUNT_OVERVIEW: "account-overview",
  SIGNATURE_TEMPLATE: "signature-template",
  APP_ORDER: "app-order",
  DASHBOARD_WIDGETS: "dashboard-widgets",
} as const satisfies Record<string, SectionKey>;

const VALID_SECTION_KEYS = Object.values(SECTION_KEYS) as SectionKey[];

const SECTIONS = [
  {
    key: SECTION_KEYS.STUDENT_LIST,
    label: "Student list",
    description: "Filter and re-export the student list spreadsheet.",
    iconClass: "icon-category-organization",
    requiresAdmin: false,
  },
  {
    key: SECTION_KEYS.STUDENT_STATS,
    label: "Student stats",
    description: "View Hufak student statistics tools.",
    iconClass: "icon-user",
    requiresAdmin: false,
  },
  {
    key: SECTION_KEYS.ACCOUNT_OVERVIEW,
    label: "account overview",
    description: "Inspect Nextcloud accounts, mailbox state, identities, activity, and app-order drift in one place.",
    iconClass: "icon-user",
  },
  {
    key: SECTION_KEYS.ADD_ACCOUNT,
    label: "create new",
    description: "Create a Nextcloud account, generate credentials, and optionally configure the primary mailbox immediately.",
    iconClass: "icon-add",
  },
  {
    key: SECTION_KEYS.MAILBOX_NAMES,
    label: "department names",
    description: "Edit the hierarchical shared mailbox config (`shared_mailboxes`).",
    iconClass: "icon-mail",
  },
  {
    key: SECTION_KEYS.SIGNATURE_TEMPLATE,
    label: "signature template",
    description: "Edit the shared Hufak signature template with a live preview.",
    iconClass: "icon-rename",
  },
  {
    key: SECTION_KEYS.DASHBOARD_WIDGETS,
    label: "nextcloud dashboard widgets",
    description: "Edit the global default dashboard widget layout used for new accounts.",
    iconClass: "icon-category-customization",
  },
  {
    key: SECTION_KEYS.APP_ORDER,
    label: "nextcloud app order",
    description: "Edit and validate the global default app-order JSON before saving it.",
    iconClass: "icon-category-office",
  },
] as const satisfies readonly {
  key: SectionKey
  label: string
  description: string
  iconClass: string
  requiresAdmin?: boolean
}[];

const SECTION_GROUPS = [
  {
    label: "Hufak tools",
    items: [SECTION_KEYS.STUDENT_LIST, SECTION_KEYS.STUDENT_STATS],
    requiresAdmin: false,
  },
  {
    label: "Nextcloud accounts",
    items: [
      SECTION_KEYS.ACCOUNT_OVERVIEW,
      SECTION_KEYS.ADD_ACCOUNT,
      SECTION_KEYS.APP_ORDER,
      SECTION_KEYS.DASHBOARD_WIDGETS,
    ],
    requiresAdmin: true,
  },
  {
    label: "NextSnapMail settings",
    items: [SECTION_KEYS.MAILBOX_NAMES, SECTION_KEYS.SIGNATURE_TEMPLATE],
    requiresAdmin: true,
  },
] as const satisfies readonly {
  label: string
  items: readonly SectionKey[]
  requiresAdmin?: boolean
}[];

function parseSectionFromUrl(): SectionKey {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("section");
  return requested !== null &&
    VALID_SECTION_KEYS.includes(requested as SectionKey)
    ? (requested as SectionKey)
    : SECTION_KEYS.OVERVIEW;
}

function getConfigureMailUidFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("uid") || "";
}

function buildSectionUrl(section: SectionKey, uid?: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("section", section);
  if (typeof uid === "string" && uid !== "") {
    url.searchParams.set("uid", uid);
  } else {
    url.searchParams.delete("uid");
  }
  return url.toString();
}

function updateUrlSection(section: SectionKey, uid?: string): void {
  window.history.pushState({}, "", buildSectionUrl(section, uid));
}

const DEFAULT_EMAIL_DOMAIN = "hufak.net";

export {
  SECTION_KEYS,
  VALID_SECTION_KEYS,
  SECTIONS,
  SECTION_GROUPS,
  buildSectionUrl,
  parseSectionFromUrl,
  getConfigureMailUidFromUrl,
  updateUrlSection,
  DEFAULT_EMAIL_DOMAIN,
};

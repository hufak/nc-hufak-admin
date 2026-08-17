export type SectionKey =
  | "contact-list"
  | "student-list"
  | "student-stats"
  | "qr-code"
  | "overview"
  | "add-account"
  | "configure-mail"
  | "mailbox-names"
  | "account-overview"
  | "signature-template"
  | "account-info-template"
  | "app-order"
  | "dashboard-widgets"
  | "kas-api"
  | "email-forwards"
  | "telegram-bot-token"
  | "telegram-angespannte";

const SECTION_KEYS = {
  CONTACT_LIST: "contact-list",
  STUDENT_LIST: "student-list",
  STUDENT_STATS: "student-stats",
  QR_CODE: "qr-code",
  OVERVIEW: "overview",
  ADD_ACCOUNT: "add-account",
  CONFIGURE_MAIL: "configure-mail",
  MAILBOX_NAMES: "mailbox-names",
  ACCOUNT_OVERVIEW: "account-overview",
  SIGNATURE_TEMPLATE: "signature-template",
  ACCOUNT_INFO_TEMPLATE: "account-info-template",
  APP_ORDER: "app-order",
  DASHBOARD_WIDGETS: "dashboard-widgets",
  KAS_TEST: "kas-api",
  EMAIL_FORWARDS: "email-forwards",
  TELEGRAM_BOT_TOKEN: "telegram-bot-token",
  TELEGRAM_ANGESPANNTE: "telegram-angespannte",
} as const satisfies Record<string, SectionKey>;

/** Icons Nextcloud ships no class for, as Material Design Icons paths:
 * "chart-bar" for the statistics, "table" for the student list. */
const MDI_CHART_BAR = "M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z";
const MDI_TABLE =
  "M5,4H19A2,2 0 0,1 21,6V18A2,2 0 0,1 19,20H5A2,2 0 0,1 3,18V6A2,2 0 0,1 5,4M5,8V12H11V8H5M13,8V12H19V8H13M5,14V18H11V14H5M13,14V18H19V14H13Z";
const MDI_SORTED_LIST =
  "M3,5H5V7H3V5M7,5H21V7H7V5M3,11H5V13H3V11M7,11H21V13H7V11M3,17H5V19H3V17M7,17H21V19H7V17Z";

const VALID_SECTION_KEYS = Object.values(SECTION_KEYS) as SectionKey[];
const QR_QUERY_PARAMETERS = [
  "qr-url",
  "qr-label",
  "qr-label-font",
  "qr-dots",
  "qr-corner-square",
  "qr-corner-dot",
  "qr-shape",
  "qr-colour",
  "qr-background-colour",
  "qr-logo-foreground-colour",
  "qr-logo-background-colour",
  "qr-logo-size",
  "qr-dots-gradient",
  "qr-corner-square-gradient",
  "qr-corner-dot-gradient",
  "qr-background-gradient",
] as const;
const SECTION_QUERY_PARAMETERS: Partial<Record<SectionKey, readonly string[]>> =
  {
    [SECTION_KEYS.QR_CODE]: QR_QUERY_PARAMETERS,
    [SECTION_KEYS.CONFIGURE_MAIL]: ["uid"],
  };

const SECTIONS = [
  {
    key: SECTION_KEYS.QR_CODE,
    label: "QR code",
    description:
      "Create a branded QR code for a URL and download it as SVG or PNG.",
    iconClass: "icon-link",
    requiresAdmin: false,
  },
  {
    key: SECTION_KEYS.EMAIL_FORWARDS,
    label: "Email forwards",
    description: "View the configured domain's ALL-INKL email forwards.",
    iconClass: "icon-mail",
    requiresAdmin: true,
  },
  {
    key: SECTION_KEYS.CONTACT_LIST,
    label: "Hufak contact list",
    description:
      "Who is on the Hufak team and how to reach them, plus the two Schlüssellisten as printable A4 extracts.",
    iconClass: "icon-group",
    requiresAdmin: false,
  },
  {
    key: SECTION_KEYS.STUDENT_LIST,
    label: "Studierendenevidenz",
    description:
      "Filter the Studierendenevidenz spreadsheet and re-export the extract you need.",
    iconClass: "icon-category-organization",
    iconPath: MDI_TABLE,
    requiresAdmin: false,
  },
  {
    key: SECTION_KEYS.STUDENT_STATS,
    label: "Student statistics",
    description:
      "An overview of how the students of the Angewandte are distributed across the degree programmes, and by gender, fee status and where they come from.",
    iconClass: "icon-category-monitoring",
    iconPath: MDI_CHART_BAR,
    requiresAdmin: false,
  },
  {
    key: SECTION_KEYS.ACCOUNT_OVERVIEW,
    label: "Account overview",
    description:
      "Inspect Nextcloud accounts, mailbox state, identities, activity, and app-order drift in one place.",
    iconClass: "icon-user",
  },
  {
    key: SECTION_KEYS.ADD_ACCOUNT,
    label: "Create new",
    description:
      "Create a Nextcloud account, generate credentials, and optionally configure the primary mailbox immediately.",
    iconClass: "icon-add",
  },
  {
    key: SECTION_KEYS.MAILBOX_NAMES,
    label: "Department names",
    description:
      "Edit the hierarchical shared mailbox config (`shared_mailboxes`).",
    iconClass: "icon-mail",
  },
  {
    key: SECTION_KEYS.SIGNATURE_TEMPLATE,
    label: "Signature template",
    description:
      "Edit the shared Hufak signature template with a live preview.",
    iconClass: "icon-rename",
  },
  {
    key: SECTION_KEYS.ACCOUNT_INFO_TEMPLATE,
    label: "Account info template",
    description:
      "Edit the Markdown template used for the printable new-account information sheet.",
    iconClass: "icon-category-office",
  },
  {
    key: SECTION_KEYS.DASHBOARD_WIDGETS,
    label: "Nextcloud dashboard widgets",
    description:
      "Edit the global default dashboard widget layout used for new accounts.",
    iconClass: "icon-home",
  },
  {
    key: SECTION_KEYS.APP_ORDER,
    label: "Nextcloud app order",
    description:
      "Edit and validate the global default app-order JSON before saving it.",
    iconClass: "icon-menu",
    iconPath: MDI_SORTED_LIST,
  },
  {
    key: SECTION_KEYS.KAS_TEST,
    label: "KAS API test",
    description:
      "Test ALL-INKL KAS API credentials and inspect basic account statistics.",
    iconClass: "icon-category-monitoring",
    requiresAdmin: true,
  },
  {
    key: SECTION_KEYS.TELEGRAM_BOT_TOKEN,
    label: "Bot API key",
    description: "Test and store the Telegram Bot API key used by this app.",
    iconClass: "icon-key",
    requiresAdmin: true,
  },
  {
    key: SECTION_KEYS.TELEGRAM_ANGESPANNTE,
    label: "Die Angespannte",
    description:
      "List Telegram administrators and their permissions in Die Angespannte.",
    iconClass: "icon-group",
    requiresAdmin: false,
  },
] as const satisfies readonly {
  key: SectionKey;
  label: string;
  description: string;
  iconClass: string;
  iconPath?: string;
  requiresAdmin?: boolean;
}[];

const SECTION_GROUPS = [
  {
    label: "Hufak data",
    items: [
      SECTION_KEYS.CONTACT_LIST,
      SECTION_KEYS.STUDENT_STATS,
      SECTION_KEYS.STUDENT_LIST,
      SECTION_KEYS.QR_CODE,
    ],
    requiresAdmin: false,
  },
  {
    label: "Accounts",
    items: [SECTION_KEYS.ACCOUNT_OVERVIEW, SECTION_KEYS.ADD_ACCOUNT],
    requiresAdmin: true,
  },
  {
    label: "Email accounts",
    items: [SECTION_KEYS.KAS_TEST, SECTION_KEYS.EMAIL_FORWARDS],
    requiresAdmin: true,
  },
  {
    label: "Nextcloud settings",
    items: [
      SECTION_KEYS.ACCOUNT_INFO_TEMPLATE,
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
  {
    label: "Telegram",
    items: [SECTION_KEYS.TELEGRAM_BOT_TOKEN, SECTION_KEYS.TELEGRAM_ANGESPANNTE],
    requiresAdmin: false,
  },
] as const satisfies readonly {
  label: string;
  items: readonly SectionKey[];
  requiresAdmin?: boolean;
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
  const allowedParameters = new Set([
    "section",
    ...(SECTION_QUERY_PARAMETERS[section] || []),
  ]);
  [...url.searchParams.keys()].forEach((parameter) => {
    if (!allowedParameters.has(parameter)) url.searchParams.delete(parameter);
  });
  url.searchParams.set("section", section);
  if (
    section === SECTION_KEYS.CONFIGURE_MAIL &&
    typeof uid === "string" &&
    uid !== ""
  ) {
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
  QR_QUERY_PARAMETERS,
  SECTIONS,
  SECTION_GROUPS,
  buildSectionUrl,
  parseSectionFromUrl,
  getConfigureMailUidFromUrl,
  updateUrlSection,
  DEFAULT_EMAIL_DOMAIN,
};

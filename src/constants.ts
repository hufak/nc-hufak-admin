export type SectionKey =
  | "overview"
  | "add-account"
  | "configure-mail"
  | "mailbox-config"
  | "account-overview"
  | "signature-template"
  | "app-order";

const SECTION_KEYS = {
  OVERVIEW: "overview",
  ADD_ACCOUNT: "add-account",
  CONFIGURE_MAIL: "configure-mail",
  MAILBOX_CONFIG: "mailbox-config",
  ACCOUNT_OVERVIEW: "account-overview",
  SIGNATURE_TEMPLATE: "signature-template",
  APP_ORDER: "app-order",
} as const satisfies Record<string, SectionKey>;

const VALID_SECTION_KEYS = Object.values(SECTION_KEYS) as SectionKey[];

const SECTIONS = [
  { key: SECTION_KEYS.ACCOUNT_OVERVIEW, label: "account overview", iconClass: "icon-user" },
  { key: SECTION_KEYS.ADD_ACCOUNT, label: "create new", iconClass: "icon-add" },
  { key: SECTION_KEYS.MAILBOX_CONFIG, label: "shared mailboxes", iconClass: "icon-mail" },
  { key: SECTION_KEYS.SIGNATURE_TEMPLATE, label: "signature template", iconClass: "icon-rename" },
  { key: SECTION_KEYS.APP_ORDER, label: "nextcloud app order", iconClass: "icon-category-office" },
] as const;

const SECTION_GROUPS = [
  {
    label: "Nextcloud accounts",
    items: [SECTION_KEYS.ACCOUNT_OVERVIEW, SECTION_KEYS.ADD_ACCOUNT],
  },
  {
    label: "Shared configuration",
    items: [SECTION_KEYS.MAILBOX_CONFIG, SECTION_KEYS.SIGNATURE_TEMPLATE, SECTION_KEYS.APP_ORDER],
  },
] as const;

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

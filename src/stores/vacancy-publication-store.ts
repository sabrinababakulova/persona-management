import { create } from "zustand";

/**
 * Vacancy fields that are shared across every publication channel. They live on the parent
 * vacancy row (not on per-channel publications), and `create-vacancy-form` edits them.
 */
export type GeneralVacancyFields = {
  /** Vacancy title shown to candidates and used as the hh.uz `name`. */
  name: string;
  /** Vacancy description in HTML. For hh.uz, must be ≥ 200 characters at submit. */
  descriptionHtml: string;
  /** Lower bound of the salary range, kept as a formatted string for display. */
  salaryFrom: string;
  /** Upper bound of the salary range, kept as a formatted string for display. */
  salaryTo: string;
  /** ISO currency code (`"UZS"` or `"USD"`); narrowed at submit time. */
  salaryCurrency: string;
  /** Free-text phone number; parsed into the hh.uz `{country, city, number}` tuple at submit. */
  contactPhone: string;
};

/**
 * hh.uz-specific fields collected on `/vacancies/<id>/publications/hh.uz`. Each ID matches an
 * entry in the hh.uz lookup endpoints (`getHhPublishLookups`).
 */
export type HhPublicationFields = {
  /** Publication title shown in the versions list and sent to hh.uz as `name`. */
  title: string;
  /** hh.uz area (city) ID. */
  areaId: string;
  /** hh.uz employment type ID. */
  employmentId: string;
  /** hh.uz work schedule ID. */
  scheduleId: string;
  /** hh.uz required experience ID. */
  experienceId: string;
  /** hh.uz professional role ID. */
  professionalRoleId: string;
  /** hh.uz billing type ID (free, paid premium, etc.). */
  billingTypeId: string;
  /** Vacancy description in hh.uz-compatible HTML. Must be ≥ 200 characters at submit. */
  descriptionHtml: string;
};

/** Telegram-specific publication draft fields. */
export type TelegramPublicationFields = {
  /** Telegram post title. */
  title: string;
  /** Telegram post body in editor HTML. */
  description: string;
};

/**
 * The set of distribution channels a vacancy can be published to. Update {@link PUBLICATION_CHANNELS}
 * when adding a new option — the literal-union type is derived from it.
 */
export const PUBLICATION_CHANNELS = ["linkedin", "hh.uz", "telegram"] as const;

/** Literal-union of the channels supported by the publication flow. */
export type PublicationChannel = (typeof PUBLICATION_CHANNELS)[number];

/**
 * In-memory slice of the vacancy-publication draft. Forms across the create/edit flow read and
 * write this shape; state lives only in memory and is cleared on full page reload.
 */
type State = {
  general: GeneralVacancyFields;
  hh: HhPublicationFields;
  telegram: TelegramPublicationFields;
  /**
   * Channels the user has chosen for the in-progress vacancy. Currently single-select via the
   * `ActionDropdown`, but kept as an array to leave room for multi-select later.
   */
  selectedChannels: PublicationChannel[];
  /** Persisted ID of the vacancy this draft is bound to (null while creating from scratch). */
  savedVacancyId: string | null;
  /**
   * Channel queued for the "save draft then navigate" handoff. Read by
   * `create-vacancy.create.onSuccess` to decide whether to route to the per-channel page or
   * open the publish modal. Intentionally **not** persisted — it's an in-flight nav flag.
   */
  pendingChannelLaunch: PublicationChannel | null;
};

/** Imperative setters exposed alongside {@link State}. */
type Actions = {
  /** Update a single general field; preserves the rest. */
  setGeneralField: <K extends keyof GeneralVacancyFields>(
    key: K,
    value: GeneralVacancyFields[K],
  ) => void;
  /** Merge a partial patch into the general fields. */
  setGeneralFields: (fields: Partial<GeneralVacancyFields>) => void;
  /** Update a single hh.uz field; preserves the rest. */
  setHhField: <K extends keyof HhPublicationFields>(
    key: K,
    value: HhPublicationFields[K],
  ) => void;
  /** Merge a partial patch into the hh.uz fields. */
  setHhFields: (fields: Partial<HhPublicationFields>) => void;
  /** Update a single Telegram field; preserves the rest. */
  setTelegramField: <K extends keyof TelegramPublicationFields>(
    key: K,
    value: TelegramPublicationFields[K],
  ) => void;
  /** Merge a partial patch into the Telegram fields. */
  setTelegramFields: (fields: Partial<TelegramPublicationFields>) => void;
  /** Replace the selected channels list. */
  setSelectedChannels: (channels: PublicationChannel[]) => void;
  /** Set the persisted vacancy ID after a successful create/update. */
  setSavedVacancyId: (id: string | null) => void;
  /** Queue (or clear) the channel that should be opened after a create-flow save. */
  setPendingChannelLaunch: (channel: PublicationChannel | null) => void;
  /** Clear every field back to the initial empty state. */
  reset: () => void;
};

const EMPTY_GENERAL: GeneralVacancyFields = {
  name: "",
  descriptionHtml: "",
  salaryFrom: "",
  salaryTo: "",
  salaryCurrency: "UZS",
  contactPhone: "",
};

const EMPTY_HH: HhPublicationFields = {
  title: "",
  areaId: "",
  employmentId: "",
  scheduleId: "",
  experienceId: "",
  professionalRoleId: "",
  billingTypeId: "",
  descriptionHtml: "",
};

const EMPTY_TELEGRAM: TelegramPublicationFields = {
  title: "",
  description: "",
};

const INITIAL_STATE: State = {
  general: EMPTY_GENERAL,
  hh: EMPTY_HH,
  telegram: EMPTY_TELEGRAM,
  selectedChannels: [],
  savedVacancyId: null,
  pendingChannelLaunch: null,
};

/**
 * Zustand store backing the multi-step vacancy publication flow.
 *
 * Held entirely in memory — no localStorage / sessionStorage persistence. Drafts are reset on
 * full page reload. Consumers should use fine-grained selectors
 * (e.g. `useVacancyPublicationStore((s) => s.hh)`) to avoid re-rendering on unrelated changes.
 */
export const useVacancyPublicationStore = create<State & Actions>()((set) => ({
  ...INITIAL_STATE,
  setGeneralField: (key, value) =>
    set((state) => ({ general: { ...state.general, [key]: value } })),
  setGeneralFields: (fields) =>
    set((state) => ({ general: { ...state.general, ...fields } })),
  setHhField: (key, value) =>
    set((state) => ({ hh: { ...state.hh, [key]: value } })),
  setHhFields: (fields) => set((state) => ({ hh: { ...state.hh, ...fields } })),
  setTelegramField: (key, value) =>
    set((state) => ({ telegram: { ...state.telegram, [key]: value } })),
  setTelegramFields: (fields) =>
    set((state) => ({ telegram: { ...state.telegram, ...fields } })),
  setSelectedChannels: (channels) => set({ selectedChannels: channels }),
  setSavedVacancyId: (id) => set({ savedVacancyId: id }),
  setPendingChannelLaunch: (channel) => set({ pendingChannelLaunch: channel }),
  reset: () => set(INITIAL_STATE),
}));

export type Journal = "reflections" | "fragments" | "annotations" | "responses" | "buildlog" | "cookbook";

export type JournalInfo = {
  id: Journal;
  label: string;
  /** One line for the journal's own page */
  description: string;
  /** A few words for covers and the desk */
  short: string;
  /** Volume numeral on the shelf */
  roman: string;
};

/** The six journals in shelf order. The one place their names and copy live */
export const JOURNALS: readonly JournalInfo[] = [
  {
    id: "reflections",
    label: "Reflections",
    description: "Long-form essays on faith, life, and what I notice.",
    short: "Long-form essays",
    roman: "I",
  },
  {
    id: "fragments",
    label: "Fragments",
    description: "Short observations. Quick and conclusive.",
    short: "Short observations",
    roman: "II",
  },
  {
    id: "annotations",
    label: "Annotations",
    description: "Scripture, theology, and the margins.",
    short: "Scripture and theology",
    roman: "III",
  },
  {
    id: "responses",
    label: "Responses",
    description: "Film, music, and creative acts.",
    short: "Film and music",
    roman: "IV",
  },
  {
    id: "buildlog",
    label: "Build log",
    description: "Software and building, thinking in progress.",
    short: "Software and building",
    roman: "V",
  },
  {
    id: "cookbook",
    label: "Cookbook",
    description: "Recipes I've made, meals I keep coming back to.",
    short: "Recipes and meals",
    roman: "VI",
  },
];

export const JOURNAL_IDS = JOURNALS.map((j) => j.id);

export function isJournal(value: string): value is Journal {
  return (JOURNAL_IDS as readonly string[]).includes(value);
}

export function journalInfo(id: Journal): JournalInfo {
  return JOURNALS.find((j) => j.id === id)!;
}

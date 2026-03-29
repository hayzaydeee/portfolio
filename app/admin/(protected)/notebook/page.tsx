import { getAllEntries, getStagedEntries } from "@/app/actions/notebook";
import { NotebookClient } from "./NotebookClient";

export default async function NotebookPage() {
  const [entries, staged] = await Promise.all([getAllEntries(), getStagedEntries()]);

  return <NotebookClient entries={entries} staged={staged} />;
}

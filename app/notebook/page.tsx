import { getShelf } from "@/lib/data/notebook";
import { JournalDesk } from "@/components/notebook/JournalDesk";

export default async function NotebookPage() {
  const shelf = await getShelf();
  return <JournalDesk shelf={shelf} />;
}

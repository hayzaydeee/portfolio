import { EntryForm } from "@/components/admin/notebook/EntryForm";

export default function NewEntryPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-sans text-(--lobby-text)">New entry</h1>
      <EntryForm />
    </div>
  );
}

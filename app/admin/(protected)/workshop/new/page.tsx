import { ProjectForm } from "@/components/admin/workshop/ProjectForm";

export default function NewProjectPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-sans text-(--lobby-text)">New project</h1>
      </div>
      <ProjectForm />
    </div>
  );
}

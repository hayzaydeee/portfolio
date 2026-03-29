"use client";

import { useState, useOptimistic, startTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { archiveProject, reorderProjects } from "@/app/actions/projects";
import type { Project } from "@/app/actions/projects";
import Link from "next/link";

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableRow({
  project,
  onArchive,
}: {
  project: Project;
  onArchive: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-black/5 hover:bg-black/2 group"
    >
      {/* Drag handle */}
      <td className="pl-4 pr-2 py-3 w-8">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing text-(--color-text-muted) hover:text-(--color-base-dark) transition-colors"
          aria-label="Reorder"
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
            <circle cx="4" cy="3" r="1.5" /><circle cx="8" cy="3" r="1.5" />
            <circle cx="4" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
            <circle cx="4" cy="13" r="1.5" /><circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>
      </td>

      {/* Name */}
      <td className="py-3 pr-4">
        <span className="text-sm text-(--color-base-dark) font-medium">{project.title}</span>
        {project.tagline && (
          <p className="text-xs text-(--color-text-muted) mt-0.5 truncate max-w-xs">{project.tagline}</p>
        )}
      </td>

      {/* is_featured indicator */}
      <td className="py-3 pr-4 text-center">
        {project.is_featured && (
          <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">lobby</span>
      )}
      </td>

      {/* Status */}
      <td className="py-3 pr-4">
        <StatusBadge status={project.status} />
      </td>

      {/* Updated */}
      <td className="py-3 pr-4 text-xs text-(--color-text-muted)">
        {new Date(project.updated_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </td>

      {/* Actions */}
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            href={`/admin/workshop/${project.id}`}
            className="text-xs text-(--color-text-muted) hover:text-(--color-base-dark) transition-colors"
          >
            Edit
          </Link>
          {project.status !== "archived" && (
            <button
              type="button"
              onClick={() => onArchive(project.id)}
              className="text-xs text-(--color-text-muted) hover:text-(--color-base-dark) transition-colors"
            >
              Archive
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Projects table ───────────────────────────────────────────────────────────

type ProjectsTableProps = {
  initialProjects: Project[];
};

export function ProjectsTable({ initialProjects }: ProjectsTableProps) {
  const [projects, setProjects] = useOptimistic<Project[]>(initialProjects);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);

    const reordered = arrayMove(projects, oldIndex, newIndex);

    startTransition(() => {
      setProjects(reordered);
    });

    await reorderProjects(reordered.map((p) => p.id));
  }

  async function handleArchive(id: string) {
    startTransition(() => {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "archived" } : p))
      );
    });
    await archiveProject(id);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/7">
              <th className="pl-4 pr-2 pb-3 w-8" />
              <th className="text-left text-xs text-(--color-text-muted) font-medium pb-3 pr-4">Project</th>
              <th className="text-center text-xs text-(--color-text-muted) font-medium pb-3 pr-4">Lobby</th>
              <th className="text-left text-xs text-(--color-text-muted) font-medium pb-3 pr-4">Status</th>
              <th className="text-left text-xs text-(--color-text-muted) font-medium pb-3 pr-4">Updated</th>
              <th className="pb-3 pr-4" />
            </tr>
          </thead>
          <tbody>
            <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {projects.map((project) => (
                <SortableRow
                  key={project.id}
                  project={project}
                  onArchive={handleArchive}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>

        {projects.length === 0 && (
          <p className="text-sm text-(--color-text-muted) text-center py-12">
            no projects yet
          </p>
        )}
      </div>
    </DndContext>
  );
}


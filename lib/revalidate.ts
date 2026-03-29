import { revalidatePath } from "next/cache";

type ContentType =
  | "project"
  | "notebook"
  | "wall"
  | "music"
  | "currently"
  | "settings";

const REVALIDATION_MAP: Record<ContentType, string[]> = {
  project: ["/", "/work", "/work/[project]"],
  notebook: ["/notebook", "/notebook/[slug]"],
  wall: ["/wall", "/wall/[piece]"],
  music: ["/music", "/music/analysis/[slug]"],
  currently: ["/", "/now"],
  settings: ["/"],
};

export function revalidateContent(type: ContentType): void {
  const paths = REVALIDATION_MAP[type] ?? [];
  for (const path of paths) {
    revalidatePath(path, "page");
  }
}

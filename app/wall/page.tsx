import { getWallPieces } from "@/lib/data/wall";
import { WallPage } from "@/components/wall/WallPage";

export const revalidate = 3600; // revalidated by cron hourly + on-demand

export default async function Wall() {
  const pieces = await getWallPieces();
  return <WallPage pieces={pieces} />;
}

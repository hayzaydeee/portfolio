import type { AnalysisEssay } from "@/app/actions/studio";

const AT = "2026-01-01T00:00:00Z";

/** Two published essays for the studio and essay harnesses */
export const ESSAYS: AnalysisEssay[] = [
  {
    id: "e-room-tone",
    slug: "room-tone",
    title: "the room is an instrument",
    subject: "on recording the space between notes",
    content: null,
    body_html:
      "<p>Every room has a pitch. Close the door, stop moving, and listen: there is a low hum the walls agree on, and anything you play in there is played against it.</p><p>The after hours sessions started as a way of recording that hum on purpose. The keys came later.</p><blockquote>Silence is never empty. It is the room telling you its key.</blockquote><p>Most of the decisions on the record are about how much of the room to keep.</p>",
    read_time_minutes: 4,
    status: "published",
    created_at: "2026-02-14T00:00:00Z",
    updated_at: AT,
  },
  {
    id: "e-platform-4",
    slug: "platform-4",
    title: "platform 4, 6:52",
    subject: "a loop built from a train announcement",
    content: null,
    body_html: "<p>The announcement repeats every eleven minutes. That is the tempo of the whole piece, slowed until it stopped sounding like a voice.</p>",
    read_time_minutes: 2,
    status: "published",
    created_at: "2026-01-03T00:00:00Z",
    updated_at: AT,
  },
];

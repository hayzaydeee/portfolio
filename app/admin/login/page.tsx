import { signIn } from "@/auth";
import { HzyMark } from "@/components/nav/HzyMark";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const accessDenied = error === "AccessDenied";

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--lobby-surface-deep)">
      {/* Ambient radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(30,107,60,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-xs px-8 py-10 bg-(--lobby-card) rounded-2xl border border-white/6 shadow-xl shadow-black/40">
        {/* Mark */}
        <div className="flex justify-center mb-9">
          <HzyMark mode="dark" size={40} animate />
        </div>

        <h1 className="font-serif text-2xl tracking-wide text-(--lobby-text) text-center mb-1.5">
          admin
        </h1>
        <p className="text-xs font-sans text-accent-muted text-center mb-9 tracking-widest uppercase">
          sign in to continue
        </p>

        {/* Access-denied notification */}
        {accessDenied && (
          <div className="mb-7 rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-3 text-xs font-sans leading-relaxed">
            <p className="text-red-300 mb-1.5">
              access denied — double-check you signed in with the right Google account.
            </p>
            <p className="text-red-500/70">
              this area is private. if you stumbled here by accident, there's nothing to see.
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-white/6 mb-9" />

        {/* Google Sign-in — Server Action */}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/admin" });
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-white/10 text-sm font-sans text-(--lobby-text) bg-white/4 hover:bg-white/8 hover:border-white/20 transition-colors cursor-pointer"
          >
            {/* Google icon */}
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}

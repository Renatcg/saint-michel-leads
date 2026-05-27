import { LeadForm } from "@/components/lead-form";
import { getLandingSettings } from "@/lib/landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const landing = await getLandingSettings();

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        poster={landing.posterUrl}
      >
        <source src={landing.videoUrl} type="video/mp4" />
      </video>
      <div className="absolute inset-0" style={{ backgroundColor: landing.overlayColor, opacity: landing.overlayOpacity }} />

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-6 py-10 md:grid-cols-[1.05fr_.95fr] md:px-10 lg:px-12">
        <div className="max-w-2xl text-left">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.26em] text-[#d8bd85]">
            {landing.eyebrow}
          </p>
          <h1 className="text-4xl font-semibold leading-[1.02] tracking-[-0.02em] sm:text-5xl lg:text-7xl">
            {landing.headline}
          </h1>
          <p className="mt-6 max-w-xl text-left text-lg leading-8 text-white/82 sm:text-xl">
            {landing.subheadline}
          </p>
        </div>

        <div className="flex justify-start md:justify-end">
          <LeadForm />
        </div>
      </section>
    </main>
  );
}

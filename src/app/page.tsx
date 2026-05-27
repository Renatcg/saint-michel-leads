import { LeadForm } from "@/components/lead-form";
import { LandingBackgroundVideo } from "@/components/landing-background-video";
import { getLandingSettings } from "@/lib/landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const landing = await getLandingSettings();

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <LandingBackgroundVideo
        fit={landing.videoFit}
        playbackRate={landing.playbackRate}
        position={landing.videoPosition}
        posterUrl={landing.posterUrl}
        videoUrl={landing.videoUrl}
      />
      <div className="absolute inset-0" style={{ backgroundColor: landing.overlayColor, opacity: landing.overlayOpacity }} />

      <header className="absolute left-0 right-0 top-0 z-20 px-6 py-5 md:px-10 lg:px-12" style={{ backgroundColor: landing.headerColor }}>
        <div className="mx-auto flex max-w-7xl justify-end">
          {landing.logoUrl ? (
            <img alt={landing.logoAlt} src={landing.logoUrl} style={{ height: landing.logoHeight, width: "auto" }} />
          ) : null}
        </div>
      </header>

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
          <LeadForm settings={landing} />
        </div>
      </section>
    </main>
  );
}

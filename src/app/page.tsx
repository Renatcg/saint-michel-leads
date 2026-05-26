import { LeadForm } from "@/components/lead-form";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        poster="https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=2200&auto=format&fit=crop"
      >
        <source
          src="https://videos.pexels.com/video-files/3773486/3773486-uhd_2560_1440_30fps.mp4"
          type="video/mp4"
        />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.76),rgba(0,0,0,.42),rgba(0,0,0,.64))]" />

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-6 py-10 md:grid-cols-[1.05fr_.95fr] md:px-10 lg:px-12">
        <div className="max-w-2xl text-left">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.26em] text-[#d8bd85]">
            Saint Michel Construtora
          </p>
          <h1 className="text-4xl font-semibold leading-[1.02] tracking-[-0.02em] sm:text-5xl lg:text-7xl">
            Seu próximo endereço com padrão de alto valor.
          </h1>
          <p className="mt-6 max-w-xl text-left text-lg leading-8 text-white/82 sm:text-xl">
            Cadastre seu interesse para receber novidades, condições especiais e atendimento consultivo sobre os próximos empreendimentos.
          </p>
        </div>

        <div className="flex justify-start md:justify-end">
          <LeadForm />
        </div>
      </section>
    </main>
  );
}

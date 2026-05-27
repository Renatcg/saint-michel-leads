import { buildSalesContactUrl, getLandingSettings } from "@/lib/landing";

export const dynamic = "force-dynamic";

const fallbackBackground =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=82";

export default async function SuccessPage() {
  const landing = await getLandingSettings();
  const salesContactUrl = buildSalesContactUrl(landing) || process.env.SALES_TEAM_CONTACT_URL || "/";
  const backgroundImage = landing.posterUrl || fallbackBackground;

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      <div className="absolute inset-0 bg-black/68" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_35%,rgba(216,189,133,0.22),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.72),rgba(0,0,0,0.2))]" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-6 md:px-10 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8bd85] sm:text-sm">
            Cadastro confirmado
          </p>
          <h1 className="mt-4 max-w-3xl text-[38px] font-semibold leading-[1.02] tracking-normal sm:text-5xl md:text-6xl lg:text-7xl">
            Parabéns. Você acaba de dar um passo importante para conquistar seu novo lar.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/84 sm:text-lg md:mt-7 md:text-xl md:leading-8">
            Seu cadastro garante o recebimento antecipado de informações privilegiadas sobre este lançamento.
            Fique atento ao seu e-mail e às mensagens da construtora para sair na frente.
          </p>
          <div className="mt-6 max-w-2xl rounded-lg border border-white/24 bg-white/12 p-4 backdrop-blur-md sm:p-5">
            <h2 className="text-lg font-semibold text-white sm:text-xl">Prepare-se antes das unidades abrirem para venda</h2>
            <p className="mt-2 text-sm leading-6 text-white/78 sm:text-base">
              Antecipar sua análise de crédito pode deixar sua jornada mais rápida, mais segura e mais estratégica quando as oportunidades forem liberadas.
            </p>
          </div>
          <a
            className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-[#98743e] px-5 py-4 text-center text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:brightness-110 sm:w-auto sm:px-7"
            href={salesContactUrl}
            rel="noreferrer"
            target={salesContactUrl.startsWith("http") ? "_blank" : undefined}
          >
            Falar agora com a equipe de corretores
          </a>
        </div>
      </section>
    </main>
  );
}

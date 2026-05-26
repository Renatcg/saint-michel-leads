import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#171511] px-6 text-white">
      <section className="w-full max-w-sm rounded-lg border border-white/12 bg-white/8 p-7 shadow-2xl backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d8bd85]">Saint Michel</p>
        <h1 className="mt-4 text-3xl font-semibold">Acesso administrativo</h1>
        <p className="mt-2 text-sm leading-6 text-white/68">
          Entre com seu usuário para acessar leads, mensagens e configurações.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}

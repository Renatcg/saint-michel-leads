import { AdminShell } from "@/components/admin-shell";

export default function MessagesPage() {
  return (
    <AdminShell>
      <section className="rounded-lg border border-black/10 bg-white p-6">
        <h1 className="text-3xl font-semibold">Mensagens</h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Próxima etapa: criar o CRUD da régua de relacionamento com templates para e-mail, WhatsApp e envios agendados.
        </p>
      </section>
    </AdminShell>
  );
}

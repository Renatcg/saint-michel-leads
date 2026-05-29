"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "VIEWER";
  active: boolean;
  createdAt: string;
};

const roleLabels = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  VIEWER: "Viewer",
};

export function AdminUsersManager({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "VIEWER" as UserRow["role"],
    active: true,
  });

  async function createUser() {
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Não foi possível criar o usuário.");
      return;
    }

    const data = await response.json();
    setUsers((current) => [data.user, ...current]);
    setOpen(false);
    setForm({ name: "", email: "", password: "", role: "VIEWER", active: true });
    setMessage("Usuário criado.");
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {message ? <p className="rounded-lg bg-white px-4 py-3 text-sm text-neutral-700">{message}</p> : <span />}
        <button className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white" type="button" onClick={() => setOpen(true)}>
          Criar usuário
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-neutral-100 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Perfil</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="border-t border-black/10" key={user.id}>
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{roleLabels[user.role]}</td>
                <td className="px-4 py-3">{user.active ? "Ativo" : "Inativo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Criar usuário</h2>
                <p className="mt-1 text-sm text-neutral-600">Admins gerenciam tudo. Viewers acessam leads e chat.</p>
              </div>
              <button className="rounded-md border border-black/15 px-3 py-2 text-sm font-semibold" type="button" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <TextInput label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} />
              <TextInput label="E-mail" value={form.email} onChange={(email) => setForm({ ...form, email })} />
              <TextInput label="Senha provisória" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
              <label>
                <span className="mb-2 block text-sm font-medium text-neutral-700">Perfil</span>
                <select
                  className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value as UserRow["role"] })}
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                Usuário ativo
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-lg border border-black/15 px-4 py-3 font-semibold text-neutral-700" type="button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="rounded-lg bg-[#98743e] px-4 py-3 font-semibold text-white disabled:opacity-60" type="button" disabled={saving} onClick={createUser}>
                {saving ? "Criando..." : "Criar usuário"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TextInput({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-neutral-700">{label}</span>
      <input
        className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

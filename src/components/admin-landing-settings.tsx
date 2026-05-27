"use client";

import { useState } from "react";
import type { LandingSettings } from "@/lib/landing";

export function AdminLandingSettings({ initialSettings, canEdit }: { initialSettings: LandingSettings; canEdit: boolean }) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/admin/landing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Não foi possível salvar a landing.");
      return;
    }

    const data = await response.json();
    setSettings(data.settings);
    setMessage("Landing atualizada.");
  }

  async function uploadVideo(files: FileList | null) {
    const file = files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setMessage("Use um vídeo de até 4 MB ou informe uma URL externa do vídeo.");
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setSettings({ ...settings, videoUrl: dataUrl });
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className="rounded-lg border border-black/10 bg-white p-5">
        <h2 className="text-xl font-semibold">Editar primeira dobra</h2>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">Vídeo por URL</span>
            <input
              className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
              disabled={!canEdit}
              value={settings.videoUrl}
              onChange={(event) => setSettings({ ...settings, videoUrl: event.target.value })}
            />
          </label>

          <label className="block rounded-lg border border-dashed border-black/20 p-4 text-sm text-neutral-700">
            <span className="block font-medium">Submeter vídeo</span>
            <span className="mt-1 block text-xs text-neutral-500">Para produção, prefira URL externa. Upload direto aceita vídeos leves de até 4 MB.</span>
            <input className="mt-3 block w-full text-sm" disabled={!canEdit} type="file" accept="video/*" onChange={(event) => uploadVideo(event.target.files)} />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">Poster do vídeo (opcional)</span>
            <input
              className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
              disabled={!canEdit}
              value={settings.posterUrl ?? ""}
              onChange={(event) => setSettings({ ...settings, posterUrl: event.target.value })}
            />
            {canEdit ? (
              <button
                className="mt-2 rounded-md border border-black/15 px-3 py-2 text-xs font-semibold"
                type="button"
                onClick={() => setSettings({ ...settings, posterUrl: "" })}
              >
                Remover poster
              </button>
            ) : null}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Cor do overlay</span>
              <input
                className="h-12 w-full rounded-lg border border-black/15 px-2"
                disabled={!canEdit}
                type="color"
                value={settings.overlayColor}
                onChange={(event) => setSettings({ ...settings, overlayColor: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Opacidade: {Math.round(settings.overlayOpacity * 100)}%</span>
              <input
                className="w-full accent-[#98743e]"
                disabled={!canEdit}
                max={1}
                min={0}
                step={0.05}
                type="range"
                value={settings.overlayOpacity}
                onChange={(event) => setSettings({ ...settings, overlayOpacity: Number(event.target.value) })}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Encaixe do vídeo</span>
              <select
                className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                disabled={!canEdit}
                value={settings.videoFit}
                onChange={(event) => setSettings({ ...settings, videoFit: event.target.value as "cover" | "contain" })}
              >
                <option value="cover">Preencher área</option>
                <option value="contain">Mostrar inteiro</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Posição do vídeo</span>
              <select
                className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                disabled={!canEdit}
                value={settings.videoPosition}
                onChange={(event) => setSettings({ ...settings, videoPosition: event.target.value })}
              >
                <option value="center center">Centro</option>
                <option value="center top">Topo</option>
                <option value="center bottom">Base</option>
                <option value="left center">Esquerda</option>
                <option value="right center">Direita</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">Velocidade: {settings.playbackRate.toFixed(2)}x</span>
            <input
              className="w-full accent-[#98743e]"
              disabled={!canEdit}
              max={2}
              min={0.25}
              step={0.05}
              type="range"
              value={settings.playbackRate}
              onChange={(event) => setSettings({ ...settings, playbackRate: Number(event.target.value) })}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">Eyebrow</span>
            <input
              className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
              disabled={!canEdit}
              value={settings.eyebrow}
              onChange={(event) => setSettings({ ...settings, eyebrow: event.target.value })}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">Headline</span>
            <textarea
              className="min-h-24 w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
              disabled={!canEdit}
              value={settings.headline}
              onChange={(event) => setSettings({ ...settings, headline: event.target.value })}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">Subheadline</span>
            <textarea
              className="min-h-28 w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
              disabled={!canEdit}
              value={settings.subheadline}
              onChange={(event) => setSettings({ ...settings, subheadline: event.target.value })}
            />
          </label>

          {canEdit ? (
            <button className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white disabled:opacity-60" type="button" disabled={loading} onClick={save}>
              Salvar landing
            </button>
          ) : null}

          {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
        </div>
      </section>

      <section className="relative min-h-[560px] overflow-hidden rounded-lg bg-neutral-950 text-white">
        <video
          key={settings.videoUrl}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: settings.videoFit, objectPosition: settings.videoPosition }}
          autoPlay
          controls
          loop
          muted
          playsInline
          preload="auto"
          poster={settings.posterUrl || undefined}
        >
          <source src={settings.videoUrl} type="video/mp4" />
        </video>
        <div className="absolute inset-0" style={{ backgroundColor: settings.overlayColor, opacity: settings.overlayOpacity }} />
        <div className="relative z-10 flex min-h-[560px] items-center p-8">
          <div className="max-w-2xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.26em] text-[#d8bd85]">{settings.eyebrow}</p>
            <h2 className="text-4xl font-semibold leading-[1.02] sm:text-5xl">{settings.headline}</h2>
            <p className="mt-6 text-lg leading-8 text-white/82">{settings.subheadline}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

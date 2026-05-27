"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";
import type { LandingSettings } from "@/lib/landing";

export function AdminLandingSettings({ initialSettings, canEdit }: { initialSettings: LandingSettings; canEdit: boolean }) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState("Aguardando carregamento do vídeo.");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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

    if (file.size > 20 * 1024 * 1024) {
      setMessage("Use um vídeo de até 20 MB.");
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setMessage("");

    try {
      const blob = await upload(`landing/${Date.now()}-${sanitizeFileName(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob/upload",
        multipart: file.size > 8 * 1024 * 1024,
        contentType: file.type,
        onUploadProgress: ({ percentage }) => setUploadProgress(percentage),
      });

      setSettings({ ...settings, videoUrl: blob.url, posterUrl: "" });
      setMessage("Vídeo enviado. Salve a landing para publicar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o vídeo.");
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  }

  async function uploadLogo(files: FileList | null) {
    const file = files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("Use uma logo de até 2 MB.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const blob = await upload(`logos/${Date.now()}-${sanitizeFileName(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob/upload",
        contentType: file.type,
      });

      setSettings({ ...settings, logoUrl: blob.url });
      setMessage("Logo enviada. Salve a landing para publicar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a logo.");
    } finally {
      setLoading(false);
    }
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

          <div className="rounded-lg border border-black/10 bg-neutral-50 p-4">
            <h3 className="text-lg font-semibold">Cabeçalho</h3>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Cor do menu/cabeçalho</span>
                <input
                  className="h-12 w-full rounded-lg border border-black/15 px-2"
                  disabled={!canEdit}
                  type="color"
                  value={settings.headerColor.startsWith("#") ? settings.headerColor : "#000000"}
                  onChange={(event) => setSettings({ ...settings, headerColor: event.target.value })}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Logo por URL</span>
                <input
                  className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                  disabled={!canEdit}
                  value={settings.logoUrl}
                  onChange={(event) => setSettings({ ...settings, logoUrl: event.target.value })}
                />
              </label>

              <label className="block rounded-lg border border-dashed border-black/20 p-4 text-sm text-neutral-700">
                <span className="block font-medium">Submeter logomarca</span>
                <span className="mt-1 block text-xs text-neutral-500">PNG, JPG, WEBP ou SVG até 2 MB.</span>
                <input className="mt-3 block w-full text-sm" disabled={!canEdit} type="file" accept="image/*,.svg" onChange={(event) => uploadLogo(event.target.files)} />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Texto alternativo da logo</span>
                  <input
                    className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                    disabled={!canEdit}
                    value={settings.logoAlt}
                    onChange={(event) => setSettings({ ...settings, logoAlt: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Altura da logo: {settings.logoHeight}px</span>
                  <input
                    className="w-full accent-[#98743e]"
                    disabled={!canEdit}
                    max={120}
                    min={24}
                    step={2}
                    type="range"
                    value={settings.logoHeight}
                    onChange={(event) => setSettings({ ...settings, logoHeight: Number(event.target.value) })}
                  />
                </label>
              </div>
            </div>
          </div>

          <label className="block rounded-lg border border-dashed border-black/20 p-4 text-sm text-neutral-700">
            <span className="block font-medium">Submeter vídeo</span>
            <span className="mt-1 block text-xs text-neutral-500">Upload via Vercel Blob. Aceita vídeos de até 20 MB, incluindo seu arquivo de 8 MB.</span>
            <input className="mt-3 block w-full text-sm" disabled={!canEdit} type="file" accept="video/*" onChange={(event) => uploadVideo(event.target.files)} />
            {uploadProgress !== null ? <span className="mt-2 block text-xs text-neutral-500">Enviando: {uploadProgress}%</span> : null}
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

          <div className="rounded-lg border border-black/10 bg-neutral-50 p-4">
            <h3 className="text-lg font-semibold">Textos do formulário</h3>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Título do formulário</span>
                <input
                  className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                  disabled={!canEdit}
                  value={settings.formTitle}
                  onChange={(event) => setSettings({ ...settings, formTitle: event.target.value })}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Descrição do formulário</span>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                  disabled={!canEdit}
                  value={settings.formDescription}
                  onChange={(event) => setSettings({ ...settings, formDescription: event.target.value })}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Label do nome</span>
                  <input
                    className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                    disabled={!canEdit}
                    value={settings.nameLabel}
                    onChange={(event) => setSettings({ ...settings, nameLabel: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Placeholder do nome</span>
                  <input
                    className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                    disabled={!canEdit}
                    value={settings.namePlaceholder}
                    onChange={(event) => setSettings({ ...settings, namePlaceholder: event.target.value })}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Label do e-mail</span>
                  <input
                    className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                    disabled={!canEdit}
                    value={settings.emailLabel}
                    onChange={(event) => setSettings({ ...settings, emailLabel: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Placeholder do e-mail</span>
                  <input
                    className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                    disabled={!canEdit}
                    value={settings.emailPlaceholder}
                    onChange={(event) => setSettings({ ...settings, emailPlaceholder: event.target.value })}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Label do WhatsApp</span>
                  <input
                    className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                    disabled={!canEdit}
                    value={settings.phoneLabel}
                    onChange={(event) => setSettings({ ...settings, phoneLabel: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Placeholder do WhatsApp</span>
                  <input
                    className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                    disabled={!canEdit}
                    value={settings.phonePlaceholder}
                    onChange={(event) => setSettings({ ...settings, phonePlaceholder: event.target.value })}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Texto do aceite</span>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                  disabled={!canEdit}
                  value={settings.consentText}
                  onChange={(event) => setSettings({ ...settings, consentText: event.target.value })}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Texto do botão</span>
                  <input
                    className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                    disabled={!canEdit}
                    value={settings.submitButtonText}
                    onChange={(event) => setSettings({ ...settings, submitButtonText: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Texto enquanto envia</span>
                  <input
                    className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                    disabled={!canEdit}
                    value={settings.loadingButtonText}
                    onChange={(event) => setSettings({ ...settings, loadingButtonText: event.target.value })}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Mensagem de sucesso</span>
                <input
                  className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                  disabled={!canEdit}
                  value={settings.successMessage}
                  onChange={(event) => setSettings({ ...settings, successMessage: event.target.value })}
                />
              </label>
            </div>
          </div>

          {canEdit ? (
            <button className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white disabled:opacity-60" type="button" disabled={loading} onClick={save}>
              Salvar landing
            </button>
          ) : null}

          {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
        </div>
      </section>

      <section className="relative min-h-[560px] overflow-hidden rounded-lg bg-neutral-950 text-white">
        <header className="absolute left-0 right-0 top-0 z-30 px-8 py-5" style={{ backgroundColor: settings.headerColor }}>
          <div className="flex justify-end">
            {settings.logoUrl ? (
              <img alt={settings.logoAlt} src={settings.logoUrl} style={{ height: settings.logoHeight, width: "auto" }} />
            ) : (
              <span className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">Logo à direita</span>
            )}
          </div>
        </header>
        {settings.videoUrl ? (
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
            src={settings.videoUrl}
            onCanPlay={() => setVideoStatus("Vídeo carregado e pronto para tocar.")}
            onError={() => setVideoStatus("Não foi possível carregar este vídeo. Verifique se a URL é pública e se o formato é compatível.")}
            onPlay={() => setVideoStatus("Vídeo em reprodução no preview.")}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-neutral-900 px-8 text-center text-white/70">
            Informe uma URL pública de vídeo ou envie um arquivo leve para visualizar aqui.
          </div>
        )}
        <div className="absolute inset-0" style={{ backgroundColor: settings.overlayColor, opacity: settings.overlayOpacity }} />
        <div className="relative z-10 flex min-h-[560px] items-center p-8">
          <div className="max-w-2xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.26em] text-[#d8bd85]">{settings.eyebrow}</p>
            <h2 className="text-4xl font-semibold leading-[1.02] sm:text-5xl">{settings.headline}</h2>
            <p className="mt-6 text-lg leading-8 text-white/82">{settings.subheadline}</p>
            <div className="mt-8 max-w-md rounded-lg border border-white/35 bg-white/70 p-5 text-neutral-950 backdrop-blur">
              <h3 className="text-2xl font-semibold">{settings.formTitle}</h3>
              <p className="mt-2 text-sm text-neutral-700">{settings.formDescription}</p>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <span className="mb-1 block font-medium">{settings.nameLabel}</span>
                  <div className="rounded-lg bg-white px-3 py-3 text-neutral-400">{settings.namePlaceholder}</div>
                </div>
                <div>
                  <span className="mb-1 block font-medium">{settings.emailLabel}</span>
                  <div className="rounded-lg bg-white px-3 py-3 text-neutral-400">{settings.emailPlaceholder}</div>
                </div>
                <div>
                  <span className="mb-1 block font-medium">{settings.phoneLabel}</span>
                  <div className="rounded-lg bg-white px-3 py-3 text-neutral-400">{settings.phonePlaceholder}</div>
                </div>
                <p className="text-xs leading-5 text-neutral-600">{settings.consentText}</p>
                <div className="rounded-lg bg-[#98743e] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-white">
                  {settings.submitButtonText}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4 z-20 rounded-lg bg-black/60 px-4 py-3 text-sm text-white">
          {videoStatus}
        </div>
      </section>
    </div>
  );
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

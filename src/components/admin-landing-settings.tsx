"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";
import type { LandingSettings } from "@/lib/landing";

type LandingTab = "header" | "hero" | "form" | "success";

const tabs: Array<{ id: LandingTab; label: string }> = [
  { id: "header", label: "Cabeçalho" },
  { id: "hero", label: "Hero" },
  { id: "form", label: "Formulário" },
  { id: "success", label: "Success" },
];

const fallbackSuccessBackground =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=82";

export function AdminLandingSettings({ initialSettings, canEdit }: { initialSettings: LandingSettings; canEdit: boolean }) {
  const [settings, setSettings] = useState(initialSettings);
  const [activeTab, setActiveTab] = useState<LandingTab>("header");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState("Aguardando carregamento do vídeo.");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  function update(next: Partial<LandingSettings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

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

      update({ videoUrl: blob.url, posterUrl: "" });
      setMessage("Vídeo enviado. Salve a landing para publicar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o vídeo.");
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  }

  async function uploadImage(
    files: FileList | null,
    field: "logoUrl" | "heroLogoUrl" | "successPageBackgroundUrl",
    folder: "logos" | "success",
    successMessage: string,
  ) {
    const file = files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setMessage("Use uma imagem de até 20 MB.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const blob = await upload(`${folder}/${Date.now()}-${sanitizeFileName(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob/upload",
        contentType: file.type,
      });

      update({ [field]: blob.url });
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[430px_1fr]">
      <section className="rounded-lg border border-black/10 bg-white p-5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                activeTab === tab.id ? "bg-[#98743e] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {activeTab === "header" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Cabeçalho</h2>
              <ColorInput label="Cor do menu/cabeçalho" value={settings.headerColor} canEdit={canEdit} onChange={(value) => update({ headerColor: value })} />
              <TextInput label="Logo por URL" value={settings.logoUrl} canEdit={canEdit} onChange={(value) => update({ logoUrl: value })} />
              <UploadBox
                accept="image/*,.svg"
                canEdit={canEdit}
                description="PNG, JPG, WEBP ou SVG até 20 MB."
                label="Submeter logomarca"
                onChange={(files) => uploadImage(files, "logoUrl", "logos", "Logo enviada. Salve a landing para publicar.")}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Texto alternativo da logo" value={settings.logoAlt} canEdit={canEdit} onChange={(value) => update({ logoAlt: value })} />
                <RangeInput
                  label={`Altura da logo: ${settings.logoHeight}px`}
                  max={120}
                  min={24}
                  step={2}
                  value={settings.logoHeight}
                  canEdit={canEdit}
                  onChange={(value) => update({ logoHeight: value })}
                />
              </div>
            </div>
          ) : null}

          {activeTab === "hero" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Hero</h2>
              <TextInput label="Vídeo por URL" value={settings.videoUrl} canEdit={canEdit} onChange={(value) => update({ videoUrl: value })} />
              <UploadBox
                accept="video/*"
                canEdit={canEdit}
                description="Upload via Vercel Blob. Aceita vídeos de até 20 MB."
                label="Submeter vídeo"
                onChange={uploadVideo}
              />
              {uploadProgress !== null ? <p className="text-xs text-neutral-500">Enviando: {uploadProgress}%</p> : null}
              <TextInput label="Poster do vídeo (opcional)" value={settings.posterUrl ?? ""} canEdit={canEdit} onChange={(value) => update({ posterUrl: value })} />
              {canEdit ? (
                <button className="rounded-md border border-black/15 px-3 py-2 text-xs font-semibold" type="button" onClick={() => update({ posterUrl: "" })}>
                  Remover poster
                </button>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <ColorInput label="Cor do overlay" value={settings.overlayColor} canEdit={canEdit} onChange={(value) => update({ overlayColor: value })} />
                <RangeInput
                  label={`Opacidade: ${Math.round(settings.overlayOpacity * 100)}%`}
                  max={1}
                  min={0}
                  step={0.05}
                  value={settings.overlayOpacity}
                  canEdit={canEdit}
                  onChange={(value) => update({ overlayOpacity: value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">Encaixe do vídeo</span>
                  <select
                    className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                    disabled={!canEdit}
                    value={settings.videoFit}
                    onChange={(event) => update({ videoFit: event.target.value as "cover" | "contain" })}
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
                    onChange={(event) => update({ videoPosition: event.target.value })}
                  >
                    <option value="center center">Centro</option>
                    <option value="center top">Topo</option>
                    <option value="center bottom">Base</option>
                    <option value="left center">Esquerda</option>
                    <option value="right center">Direita</option>
                  </select>
                </label>
              </div>

              <RangeInput
                label={`Velocidade: ${settings.playbackRate.toFixed(2)}x`}
                max={2}
                min={0.25}
                step={0.05}
                value={settings.playbackRate}
                canEdit={canEdit}
                onChange={(value) => update({ playbackRate: value })}
              />

              <div className="rounded-lg border border-black/10 bg-neutral-50 p-4">
                <h3 className="text-lg font-semibold">Acima da headline</h3>
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-neutral-700">Usar texto, logo ou ocultar?</span>
                    <select
                      className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
                      disabled={!canEdit}
                      value={settings.heroTopMode}
                      onChange={(event) => update({ heroTopMode: event.target.value as "text" | "logo" | "none" })}
                    >
                      <option value="text">Texto</option>
                      <option value="logo">Logo</option>
                      <option value="none">Ocultar</option>
                    </select>
                  </label>

                  {settings.heroTopMode === "none" ? (
                    <p className="rounded-lg bg-white px-3 py-3 text-sm text-neutral-600">O espaço acima da headline ficará oculto na landing.</p>
                  ) : settings.heroTopMode === "text" ? (
                    <TextInput label="Texto acima da headline" value={settings.eyebrow} canEdit={canEdit} onChange={(value) => update({ eyebrow: value })} />
                  ) : (
                    <div className="space-y-4">
                      <TextInput label="Logo acima da headline por URL" value={settings.heroLogoUrl} canEdit={canEdit} onChange={(value) => update({ heroLogoUrl: value })} />
                      <UploadBox
                        accept="image/*,.svg"
                        canEdit={canEdit}
                        description="PNG, JPG, WEBP ou SVG até 20 MB."
                        label="Submeter logo acima da headline"
                        onChange={(files) => uploadImage(files, "heroLogoUrl", "logos", "Logo acima da headline enviada. Salve a landing para publicar.")}
                      />
                      <TextInput label="Texto alternativo" value={settings.heroLogoAlt} canEdit={canEdit} onChange={(value) => update({ heroLogoAlt: value })} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <RangeInput
                          label={`Opacidade: ${Math.round(settings.heroLogoOpacity * 100)}%`}
                          max={1}
                          min={0}
                          step={0.05}
                          value={settings.heroLogoOpacity}
                          canEdit={canEdit}
                          onChange={(value) => update({ heroLogoOpacity: value })}
                        />
                        <RangeInput
                          label={`Tamanho: ${settings.heroLogoScale.toFixed(2)}x`}
                          max={3}
                          min={0.25}
                          step={0.05}
                          value={settings.heroLogoScale}
                          canEdit={canEdit}
                          onChange={(value) => update({ heroLogoScale: value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <TextArea label="Headline" value={settings.headline} canEdit={canEdit} onChange={(value) => update({ headline: value })} />
              <TextArea label="Subheadline" value={settings.subheadline} canEdit={canEdit} onChange={(value) => update({ subheadline: value })} rows="min-h-28" />
            </div>
          ) : null}

          {activeTab === "form" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Formulário</h2>
              <TextInput label="Título do formulário" value={settings.formTitle} canEdit={canEdit} onChange={(value) => update({ formTitle: value })} />
              <TextArea label="Descrição do formulário" value={settings.formDescription} canEdit={canEdit} onChange={(value) => update({ formDescription: value })} rows="min-h-20" />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Label do nome" value={settings.nameLabel} canEdit={canEdit} onChange={(value) => update({ nameLabel: value })} />
                <TextInput label="Placeholder do nome" value={settings.namePlaceholder} canEdit={canEdit} onChange={(value) => update({ namePlaceholder: value })} />
                <TextInput label="Label do e-mail" value={settings.emailLabel} canEdit={canEdit} onChange={(value) => update({ emailLabel: value })} />
                <TextInput label="Placeholder do e-mail" value={settings.emailPlaceholder} canEdit={canEdit} onChange={(value) => update({ emailPlaceholder: value })} />
                <TextInput label="Label do WhatsApp" value={settings.phoneLabel} canEdit={canEdit} onChange={(value) => update({ phoneLabel: value })} />
                <TextInput label="Placeholder do WhatsApp" value={settings.phonePlaceholder} canEdit={canEdit} onChange={(value) => update({ phonePlaceholder: value })} />
              </div>
              <TextArea label="Texto do aceite" value={settings.consentText} canEdit={canEdit} onChange={(value) => update({ consentText: value })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Texto do botão" value={settings.submitButtonText} canEdit={canEdit} onChange={(value) => update({ submitButtonText: value })} />
                <ColorInput label="Cor do botão" value={settings.submitButtonColor} canEdit={canEdit} onChange={(value) => update({ submitButtonColor: value })} />
                <TextInput label="Texto enquanto envia" value={settings.loadingButtonText} canEdit={canEdit} onChange={(value) => update({ loadingButtonText: value })} />
                <TextInput label="Mensagem de erro" value={settings.errorMessage} canEdit={canEdit} onChange={(value) => update({ errorMessage: value })} />
              </div>
            </div>
          ) : null}

          {activeTab === "success" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Success</h2>
              <TextInput label="Imagem de fundo por URL" value={settings.successPageBackgroundUrl} canEdit={canEdit} onChange={(value) => update({ successPageBackgroundUrl: value })} />
              <UploadBox
                accept="image/*"
                canEdit={canEdit}
                description="PNG, JPG ou WEBP até 20 MB."
                label="Submeter imagem de fundo"
                onChange={(files) => uploadImage(files, "successPageBackgroundUrl", "success", "Imagem de fundo enviada. Salve a landing para publicar.")}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorInput label="Cor do overlay" value={settings.successPageOverlayColor} canEdit={canEdit} onChange={(value) => update({ successPageOverlayColor: value })} />
                <RangeInput
                  label={`Opacidade: ${Math.round(settings.successPageOverlayOpacity * 100)}%`}
                  max={1}
                  min={0}
                  step={0.05}
                  value={settings.successPageOverlayOpacity}
                  canEdit={canEdit}
                  onChange={(value) => update({ successPageOverlayOpacity: value })}
                />
              </div>
              <TextInput label="Texto pequeno acima do título" value={settings.successPageEyebrow} canEdit={canEdit} onChange={(value) => update({ successPageEyebrow: value })} />
              <TextArea label="Título principal" value={settings.successPageHeadline} canEdit={canEdit} onChange={(value) => update({ successPageHeadline: value })} />
              <TextArea label="Texto de apoio" value={settings.successPageDescription} canEdit={canEdit} onChange={(value) => update({ successPageDescription: value })} rows="min-h-28" />
              <TextInput label="Título do bloco de preparação" value={settings.successPageCardTitle} canEdit={canEdit} onChange={(value) => update({ successPageCardTitle: value })} />
              <TextArea label="Texto do bloco de preparação" value={settings.successPageCardText} canEdit={canEdit} onChange={(value) => update({ successPageCardText: value })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Texto do botão" value={settings.successPageButtonText} canEdit={canEdit} onChange={(value) => update({ successPageButtonText: value })} />
                <ColorInput label="Cor do botão" value={settings.successPageButtonColor} canEdit={canEdit} onChange={(value) => update({ successPageButtonColor: value })} />
              </div>
            </div>
          ) : null}

          {canEdit ? (
            <button className="rounded-lg bg-[#98743e] px-5 py-3 font-semibold text-white disabled:opacity-60" type="button" disabled={loading} onClick={save}>
              Salvar configurações
            </button>
          ) : null}

          {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
        </div>
      </section>

      {activeTab === "success" ? <SuccessPreview settings={settings} /> : <LandingPreview settings={settings} videoStatus={videoStatus} setVideoStatus={setVideoStatus} />}
    </div>
  );
}

function TextInput({ label, value, canEdit, onChange }: { label: string; value: string; canEdit: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">{label}</span>
      <input
        className="w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]"
        disabled={!canEdit}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  canEdit,
  onChange,
  rows = "min-h-24",
}: {
  label: string;
  value: string;
  canEdit: boolean;
  onChange: (value: string) => void;
  rows?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">{label}</span>
      <textarea
        className={`${rows} w-full rounded-lg border border-black/15 px-3 py-3 outline-none focus:border-[#98743e]`}
        disabled={!canEdit}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ColorInput({ label, value, canEdit, onChange }: { label: string; value: string; canEdit: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">{label}</span>
      <input
        className="h-12 w-full rounded-lg border border-black/15 px-2"
        disabled={!canEdit}
        type="color"
        value={value.startsWith("#") ? value : "#000000"}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  canEdit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  canEdit: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">{label}</span>
      <input className="w-full accent-[#98743e]" disabled={!canEdit} max={max} min={min} step={step} type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function UploadBox({
  label,
  description,
  accept,
  canEdit,
  onChange,
}: {
  label: string;
  description: string;
  accept: string;
  canEdit: boolean;
  onChange: (files: FileList | null) => void;
}) {
  return (
    <label className="block rounded-lg border border-dashed border-black/20 p-4 text-sm text-neutral-700">
      <span className="block font-medium">{label}</span>
      <span className="mt-1 block text-xs text-neutral-500">{description}</span>
      <input className="mt-3 block w-full text-sm" disabled={!canEdit} type="file" accept={accept} onChange={(event) => onChange(event.target.files)} />
    </label>
  );
}

function LandingPreview({
  settings,
  videoStatus,
  setVideoStatus,
}: {
  settings: LandingSettings;
  videoStatus: string;
  setVideoStatus: (status: string) => void;
}) {
  return (
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
          {settings.heroTopMode === "none" ? null : settings.heroTopMode === "logo" && settings.heroLogoUrl ? (
            <img
              alt={settings.heroLogoAlt}
              className="mb-6 block h-auto max-w-[220px]"
              src={settings.heroLogoUrl}
              style={{
                opacity: settings.heroLogoOpacity,
                transform: `scale(${settings.heroLogoScale})`,
                transformOrigin: "left center",
              }}
            />
          ) : (
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.26em] text-[#d8bd85]">{settings.eyebrow}</p>
          )}
          <h2 className="text-4xl font-semibold leading-[1.02] sm:text-5xl">{settings.headline}</h2>
          <p className="mt-6 text-lg leading-8 text-white/82">{settings.subheadline}</p>
          <div className="mt-8 max-w-md rounded-lg border border-white/35 bg-white/70 p-5 text-neutral-950 backdrop-blur">
            <h3 className="text-2xl font-semibold">{settings.formTitle}</h3>
            <p className="mt-2 text-sm text-neutral-700">{settings.formDescription}</p>
            <div className="mt-4 space-y-3 text-sm">
              <PreviewField label={settings.nameLabel} placeholder={settings.namePlaceholder} />
              <PreviewField label={settings.emailLabel} placeholder={settings.emailPlaceholder} />
              <PreviewField label={settings.phoneLabel} placeholder={settings.phonePlaceholder} />
              <p className="text-xs leading-5 text-neutral-600">{settings.consentText}</p>
              <div className="rounded-lg px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-white" style={{ backgroundColor: settings.submitButtonColor }}>
                {settings.submitButtonText}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-20 rounded-lg bg-black/60 px-4 py-3 text-sm text-white">{videoStatus}</div>
    </section>
  );
}

function SuccessPreview({ settings }: { settings: LandingSettings }) {
  const backgroundImage = settings.successPageBackgroundUrl || settings.posterUrl || fallbackSuccessBackground;

  return (
    <section className="relative min-h-[560px] overflow-hidden rounded-lg bg-neutral-950 text-white">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundImage})` }} />
      <div className="absolute inset-0" style={{ backgroundColor: settings.successPageOverlayColor, opacity: settings.successPageOverlayOpacity }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_35%,rgba(216,189,133,0.22),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.72),rgba(0,0,0,0.2))]" />
      <div className="relative z-10 flex min-h-[560px] items-center p-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8bd85]">{settings.successPageEyebrow}</p>
          <h2 className="mt-4 text-4xl font-semibold leading-[1.02] sm:text-5xl">{settings.successPageHeadline}</h2>
          <p className="mt-5 text-lg leading-8 text-white/82">{settings.successPageDescription}</p>
          <div className="mt-6 rounded-lg border border-white/24 bg-white/12 p-5 backdrop-blur-md">
            <h3 className="text-xl font-semibold">{settings.successPageCardTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-white/78">{settings.successPageCardText}</p>
          </div>
          <div className="mt-7 inline-flex rounded-lg px-5 py-4 text-xs font-bold uppercase tracking-[0.16em]" style={{ backgroundColor: settings.successPageButtonColor }}>
            {settings.successPageButtonText}
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <span className="mb-1 block font-medium">{label}</span>
      <div className="rounded-lg bg-white px-3 py-3 text-neutral-400">{placeholder}</div>
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

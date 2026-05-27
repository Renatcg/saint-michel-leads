import { MessageChannel, MessageTrigger } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

export type LandingSettings = {
  videoUrl: string;
  posterUrl?: string;
  videoFit: "cover" | "contain";
  videoPosition: string;
  playbackRate: number;
  overlayColor: string;
  overlayOpacity: number;
  eyebrow: string;
  headline: string;
  subheadline: string;
};

export const LANDING_SETTINGS_KEY = "__landing_settings";

export const defaultLandingSettings: LandingSettings = {
  videoUrl: "",
  posterUrl: "",
  videoFit: "cover",
  videoPosition: "center center",
  playbackRate: 1,
  overlayColor: "#000000",
  overlayOpacity: 0.62,
  eyebrow: "Saint Michel Construtora",
  headline: "Seu próximo endereço com padrão de alto valor.",
  subheadline:
    "Cadastre seu interesse para receber novidades, condições especiais e atendimento consultivo sobre os próximos empreendimentos.",
};

export async function getLandingSettings() {
  const prisma = getPrisma();
  const stored = await prisma.messageTemplate.findFirst({
    where: { name: LANDING_SETTINGS_KEY },
  });

  if (!stored) {
    return defaultLandingSettings;
  }

  try {
    return normalizeLandingSettings(JSON.parse(stored.body));
  } catch {
    return defaultLandingSettings;
  }
}

export async function saveLandingSettings(settings: LandingSettings) {
  const prisma = getPrisma();
  const normalized = normalizeLandingSettings(settings);
  const existing = await prisma.messageTemplate.findFirst({
    where: { name: LANDING_SETTINGS_KEY },
  });

  if (existing) {
    await prisma.messageTemplate.update({
      where: { id: existing.id },
      data: {
        body: JSON.stringify(normalized),
        active: false,
      },
    });
    return normalized;
  }

  await prisma.messageTemplate.create({
    data: {
      name: LANDING_SETTINGS_KEY,
      channel: MessageChannel.EMAIL,
      trigger: MessageTrigger.MANUAL,
      delayDays: 0,
      subject: "Configuração interna da landing",
      body: JSON.stringify(normalized),
      active: false,
    },
  });

  return normalized;
}

export function normalizeLandingSettings(settings: Partial<LandingSettings>): LandingSettings {
  const videoUrl =
    settings.videoUrl && !settings.videoUrl.includes("videos.pexels.com/video-files/3773486")
      ? settings.videoUrl
      : "";

  return {
    videoUrl,
    posterUrl: settings.posterUrl || "",
    videoFit: settings.videoFit === "contain" ? "contain" : "cover",
    videoPosition: settings.videoPosition || defaultLandingSettings.videoPosition,
    playbackRate: clamp(Number(settings.playbackRate ?? defaultLandingSettings.playbackRate), 0.25, 2),
    overlayColor: settings.overlayColor || defaultLandingSettings.overlayColor,
    overlayOpacity: clamp(Number(settings.overlayOpacity ?? defaultLandingSettings.overlayOpacity), 0, 1),
    eyebrow: settings.eyebrow || defaultLandingSettings.eyebrow,
    headline: settings.headline || defaultLandingSettings.headline,
    subheadline: settings.subheadline || defaultLandingSettings.subheadline,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

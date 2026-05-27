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
  headerColor: string;
  logoUrl: string;
  logoAlt: string;
  logoHeight: number;
  eyebrow: string;
  headline: string;
  subheadline: string;
  formTitle: string;
  formDescription: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  consentText: string;
  submitButtonText: string;
  loadingButtonText: string;
  successMessage: string;
  errorMessage: string;
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
  headerColor: "rgba(0,0,0,0)",
  logoUrl: "",
  logoAlt: "Saint Michel Construtora",
  logoHeight: 56,
  eyebrow: "Saint Michel Construtora",
  headline: "Seu próximo endereço com padrão de alto valor.",
  subheadline:
    "Cadastre seu interesse para receber novidades, condições especiais e atendimento consultivo sobre os próximos empreendimentos.",
  formTitle: "Receba atendimento",
  formDescription: "Deixe seus dados para falar com a equipe da Saint Michel.",
  nameLabel: "Nome",
  namePlaceholder: "Seu nome completo",
  emailLabel: "Seu melhor e-mail",
  emailPlaceholder: "voce@email.com",
  phoneLabel: "Telefone (WhatsApp)",
  phonePlaceholder: "(00) 00000-0000",
  consentText:
    "Aceito o uso dos meus dados pela Saint Michel Construtora e parceiros para contato comercial e relacionamento.",
  submitButtonText: "Quero saber mais",
  loadingButtonText: "Enviando...",
  successMessage: "Cadastro recebido. Em breve nossa equipe entra em contato.",
  errorMessage: "Não foi possível enviar agora. Tente novamente.",
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
    headerColor: settings.headerColor || defaultLandingSettings.headerColor,
    logoUrl: settings.logoUrl || "",
    logoAlt: settings.logoAlt || defaultLandingSettings.logoAlt,
    logoHeight: clamp(Number(settings.logoHeight ?? defaultLandingSettings.logoHeight), 24, 120),
    eyebrow: settings.eyebrow || defaultLandingSettings.eyebrow,
    headline: settings.headline || defaultLandingSettings.headline,
    subheadline: settings.subheadline || defaultLandingSettings.subheadline,
    formTitle: settings.formTitle || defaultLandingSettings.formTitle,
    formDescription: settings.formDescription || defaultLandingSettings.formDescription,
    nameLabel: settings.nameLabel || defaultLandingSettings.nameLabel,
    namePlaceholder: settings.namePlaceholder || defaultLandingSettings.namePlaceholder,
    emailLabel: settings.emailLabel || defaultLandingSettings.emailLabel,
    emailPlaceholder: settings.emailPlaceholder || defaultLandingSettings.emailPlaceholder,
    phoneLabel: settings.phoneLabel || defaultLandingSettings.phoneLabel,
    phonePlaceholder: settings.phonePlaceholder || defaultLandingSettings.phonePlaceholder,
    consentText: settings.consentText || defaultLandingSettings.consentText,
    submitButtonText: settings.submitButtonText || defaultLandingSettings.submitButtonText,
    loadingButtonText: settings.loadingButtonText || defaultLandingSettings.loadingButtonText,
    successMessage: settings.successMessage || defaultLandingSettings.successMessage,
    errorMessage: settings.errorMessage || defaultLandingSettings.errorMessage,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

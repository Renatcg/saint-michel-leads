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
  heroTopMode: "text" | "logo" | "none";
  heroLogoUrl: string;
  heroLogoAlt: string;
  heroLogoOpacity: number;
  heroLogoScale: number;
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
  submitButtonColor: string;
  loadingButtonText: string;
  successMessage: string;
  errorMessage: string;
  salesPhone: string;
  successPageEyebrow: string;
  successPageHeadline: string;
  successPageDescription: string;
  successPageCardTitle: string;
  successPageCardText: string;
  successPageButtonText: string;
  successPageButtonColor: string;
  successPageBackgroundUrl: string;
  successPageOverlayColor: string;
  successPageOverlayOpacity: number;
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
  heroTopMode: "text",
  heroLogoUrl: "",
  heroLogoAlt: "Saint Michel Construtora",
  heroLogoOpacity: 1,
  heroLogoScale: 1,
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
  submitButtonColor: "#98743e",
  loadingButtonText: "Enviando...",
  successMessage: "Cadastro recebido. Em breve nossa equipe entra em contato.",
  errorMessage: "Não foi possível enviar agora. Tente novamente.",
  salesPhone: "",
  successPageEyebrow: "Cadastro confirmado",
  successPageHeadline: "Parabéns. Você acaba de dar um passo importante para conquistar seu novo lar.",
  successPageDescription:
    "Seu cadastro garante o recebimento antecipado de informações privilegiadas sobre este lançamento. Fique atento ao seu e-mail e às mensagens da construtora para sair na frente.",
  successPageCardTitle: "Prepare-se antes das unidades abrirem para venda",
  successPageCardText:
    "Antecipar sua análise de crédito pode deixar sua jornada mais rápida, mais segura e mais estratégica quando as oportunidades forem liberadas.",
  successPageButtonText: "Falar agora com a equipe de corretores",
  successPageButtonColor: "#98743e",
  successPageBackgroundUrl: "",
  successPageOverlayColor: "#000000",
  successPageOverlayOpacity: 0.68,
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
    heroTopMode: settings.heroTopMode === "logo" || settings.heroTopMode === "none" ? settings.heroTopMode : "text",
    heroLogoUrl: settings.heroLogoUrl || "",
    heroLogoAlt: settings.heroLogoAlt || defaultLandingSettings.heroLogoAlt,
    heroLogoOpacity: clamp(Number(settings.heroLogoOpacity ?? defaultLandingSettings.heroLogoOpacity), 0, 1),
    heroLogoScale: clamp(Number(settings.heroLogoScale ?? defaultLandingSettings.heroLogoScale), 0.25, 3),
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
    submitButtonColor: settings.submitButtonColor || defaultLandingSettings.submitButtonColor,
    loadingButtonText: settings.loadingButtonText || defaultLandingSettings.loadingButtonText,
    successMessage: settings.successMessage || defaultLandingSettings.successMessage,
    errorMessage: settings.errorMessage || defaultLandingSettings.errorMessage,
    salesPhone: settings.salesPhone || defaultLandingSettings.salesPhone,
    successPageEyebrow: settings.successPageEyebrow || defaultLandingSettings.successPageEyebrow,
    successPageHeadline: settings.successPageHeadline || defaultLandingSettings.successPageHeadline,
    successPageDescription: settings.successPageDescription || defaultLandingSettings.successPageDescription,
    successPageCardTitle: settings.successPageCardTitle || defaultLandingSettings.successPageCardTitle,
    successPageCardText: settings.successPageCardText || defaultLandingSettings.successPageCardText,
    successPageButtonText: settings.successPageButtonText || defaultLandingSettings.successPageButtonText,
    successPageButtonColor: settings.successPageButtonColor || defaultLandingSettings.successPageButtonColor,
    successPageBackgroundUrl: settings.successPageBackgroundUrl || defaultLandingSettings.successPageBackgroundUrl,
    successPageOverlayColor: settings.successPageOverlayColor || defaultLandingSettings.successPageOverlayColor,
    successPageOverlayOpacity: clamp(
      Number(settings.successPageOverlayOpacity ?? defaultLandingSettings.successPageOverlayOpacity),
      0,
      1,
    ),
  };
}

export function buildSalesContactUrl(settings: Pick<LandingSettings, "salesPhone">) {
  const digits = settings.salesPhone.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const phoneWithCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${phoneWithCountryCode}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

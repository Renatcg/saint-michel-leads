export function markdownToHtml(text: string) {
  if (looksLikeHtml(text)) {
    return text;
  }

  return text
    .split("\n")
    .map((line) => {
      const button = line.match(/^\s*\[([^\]]+)\]\((https?:\/\/[^)]+|mailto:[^)]+|data:[^)]+)\)\s*$/);
      const image = line.match(/^\s*!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)\s*$/);
      const heading = line.match(/^\s*#{1,2}\s+(.+)$/);

      if (button) {
        return `<p style="margin:28px 0;"><a href="${escapeHtml(button[2])}" style="display:inline-block;background:#98743e;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:700;">${escapeHtml(button[1])}</a></p>`;
      }

      if (image) {
        return `<p style="margin:22px 0;"><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" style="max-width:100%;border-radius:8px;display:block;" /></p>`;
      }

      if (heading) {
        return `<h2 style="font-size:22px;line-height:1.25;margin:24px 0 12px;">${formatInline(heading[1])}</h2>`;
      }

      return `<p>${line ? formatInline(line) : "&nbsp;"}</p>`;
    })
    .join("");
}

function looksLikeHtml(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

export function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatInline(text: string) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

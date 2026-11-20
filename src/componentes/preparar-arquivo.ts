/**
 * Reduz fotos no aparelho antes de enviar: uma foto de celular de 4 MB vira um JPEG de ~300 KB,
 * ainda legível para ler uma nota fiscal. PDF e o que o navegador não sabe abrir vão como estão.
 */
const LADO_MAXIMO = 2000;
const QUALIDADE = 0.82;

export async function prepararArquivo(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.type === "image/gif" || f.type === "image/svg+xml") return f;
  try {
    const imagem = await createImageBitmap(f, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
    // Já pequena e num formato que todo navegador mostra: não mexe.
    if (escala === 1 && f.size <= 700_000 && /^image\/(jpeg|png|webp)$/.test(f.type)) {
      imagem.close();
      return f;
    }
    const w = Math.round(imagem.width * escala);
    const h = Math.round(imagem.height * escala);
    const tela = document.createElement("canvas");
    tela.width = w;
    tela.height = h;
    const ctx = tela.getContext("2d");
    if (!ctx) return f;
    // Fundo branco: print de tela com transparência não fica preto no JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(imagem, 0, 0, w, h);
    imagem.close();
    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/jpeg", QUALIDADE));
    if (!blob || blob.size >= f.size) return f;
    const nome = (f.name.replace(/\.[^.]+$/, "") || "comprovante") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg", lastModified: f.lastModified });
  } catch {
    // HEIC num navegador que não abre HEIC, por exemplo: envia o original.
    return f;
  }
}

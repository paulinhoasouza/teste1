import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "A dois",
    short_name: "A dois",
    description: "Controle financeiro do casal",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f7",
    theme_color: "#f3f5f7",
    lang: "pt-BR",
    icons: [{ src: "/icone.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

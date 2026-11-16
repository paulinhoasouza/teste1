import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAtivo } from "@/lib/servidor/sessao";
import { FormEntrar } from "./form";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default function Entrar() {
  if (!loginAtivo()) redirect("/");
  return <FormEntrar />;
}

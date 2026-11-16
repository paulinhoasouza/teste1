import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigeLogin } from "@/lib/servidor/ambiente";
import { FormEntrar } from "./form";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default function Entrar() {
  if (!exigeLogin()) redirect("/");
  return <FormEntrar />;
}

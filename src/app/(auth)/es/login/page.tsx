import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PicchuSpotLogo } from "@/components/brand";
import LoginForm, { type LoginFormCopy } from "../../login/LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión | Portal de clientes PicchuSpot",
  robots: { index: false, follow: false },
};

const loginCopy: LoginFormCopy = {
  emailLabel: "Correo electrónico",
  emailPlaceholder: "tu@email.com",
  passwordLabel: "Contraseña",
  passwordPlaceholder: "Tu contraseña",
  forgotPassword: "¿Has olvidado la contraseña?",
  submit: "Iniciar sesión en tu cuenta",
  submitting: "Iniciando sesión...",
  noAccount: "¿No tienes cuenta?",
  createAccount: "Crear una",
  invalidCredentials:
    "Correo electrónico o contraseña incorrectos. Inténtalo de nuevo.",
  unexpectedError: "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
};

export default function SpanishLoginPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mb-6">
        <Link
          href="/es"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          Volver al sitio
        </Link>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/es"
            className="inline-flex items-center gap-2 mb-5 group"
            aria-label="Inicio de PicchuSpot"
          >
            <PicchuSpotLogo
              variant="mark"
              className="h-7 w-auto"
              width={56}
              height={28}
              alt="PicchuSpot"
            />
            <span className="text-xl font-bold text-primary tracking-tight group-hover:text-primary-light transition-colors">
              PicchuSpot
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-primary/8 border border-primary/15 rounded text-primary text-[9px] font-bold uppercase tracking-[0.18em]">
              Portal
            </span>
          </Link>
          <h1 className="text-2xl sm:text-[26px] font-bold text-primary leading-tight">
            Bienvenido de nuevo
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Inicia sesión para gestionar tus pedidos y archivos.
          </p>
        </div>

        <div className="bg-white border border-border rounded-2xl shadow-sm p-6 sm:p-8">
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm copy={loginCopy} signupHref="/es/signup" />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted leading-relaxed">
          Este portal es solo para clientes de PicchuSpot.{" "}
          <Link href="/es/contact" className="underline hover:text-primary transition-colors">
            Contacta con nosotros
          </Link>{" "}
          si necesitas ayuda para acceder a tu cuenta.
        </p>
      </div>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-11 bg-primary/20 rounded-xl" />
    </div>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import SignUpForm, { type SignUpFormCopy } from "../../signup/SignUpForm";

export const metadata: Metadata = {
  title: "Crear cuenta | Portal de clientes PicchuSpot",
  robots: { index: false, follow: false },
};

const signUpCopy: SignUpFormCopy = {
  fullNameLabel: "Nombre completo",
  fullNamePlaceholder: "Jane Smith",
  emailLabel: "Correo electrónico",
  emailPlaceholder: "tu@email.com",
  passwordLabel: "Contraseña",
  passwordPlaceholder: "Mín. 8 caracteres",
  confirmPasswordLabel: "Confirmar contraseña",
  confirmPasswordPlaceholder: "Repite tu contraseña",
  submit: "Crear cuenta",
  submitting: "Creando cuenta...",
  alreadyHaveAccount: "¿Ya tienes cuenta?",
  signIn: "Iniciar sesión",
  successTitle: "Revisa tu correo",
  successMessage:
    "Hemos enviado un enlace de confirmación a tu correo electrónico. Haz clic para activar tu cuenta; iniciarás sesión automáticamente.",
  backToSignIn: "Volver a iniciar sesión",
  missingName: "Introduce tu nombre completo.",
  shortPassword: "La contraseña debe tener al menos 8 caracteres.",
  passwordMismatch: "Las contraseñas no coinciden.",
  unexpectedError: "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
};

export default function SpanishSignUpPage() {
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
            <span className="text-xl font-bold text-primary tracking-tight group-hover:text-primary-light transition-colors">
              PicchuSpot
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-primary/8 border border-primary/15 rounded text-primary text-[9px] font-bold uppercase tracking-[0.18em]">
              Portal
            </span>
          </Link>
          <h1 className="text-2xl sm:text-[26px] font-bold text-primary leading-tight">
            Crea tu cuenta
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Gestiona tus pedidos, archivos y facturas de PicchuSpot.
          </p>
        </div>

        <div className="bg-white border border-border rounded-2xl shadow-sm p-6 sm:p-8">
          <Suspense fallback={<SignUpFormSkeleton />}>
            <SignUpForm copy={signUpCopy} loginHref="/es/login" />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted leading-relaxed">
          Al crear una cuenta aceptas nuestros{" "}
          <Link href="/es/terms" className="underline hover:text-primary transition-colors">
            Términos de servicio
          </Link>{" "}
          y nuestra{" "}
          <Link href="/es/privacy" className="underline hover:text-primary transition-colors">
            Política de privacidad
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function SignUpFormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-10 bg-surface rounded-lg" />
      <div className="h-11 bg-primary/20 rounded-xl" />
    </div>
  );
}

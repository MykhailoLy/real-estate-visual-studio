import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTurnstileSiteKeyFromEnv } from "@/components/auth/turnstile";
import WelcomeOfferCallout from "@/components/auth/WelcomeOfferCallout";
import SignupPageShell from "@/components/auth/SignupPageShell";
import { WELCOME_OFFER_PUBLIC_COPY } from "@/lib/welcome-offer";
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
  turnstile: {
    loading: "Completando comprobacion de seguridad...",
    required: "Completa la comprobacion de seguridad.",
    failed: "La comprobacion de seguridad fallo. Intentalo de nuevo.",
    retry: "Reintentar comprobacion",
  },
};

export default function SpanishSignUpPage() {
  const turnstileSiteKey = getTurnstileSiteKeyFromEnv();

  return (
    <SignupPageShell>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold leading-tight text-primary sm:text-[26px]">
          Crea tu cuenta
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Gestiona tus pedidos, archivos y facturas de PicchuSpot.
        </p>
      </div>

      <WelcomeOfferCallout
        copy={{
          title: WELCOME_OFFER_PUBLIC_COPY.es.title,
          prompt: WELCOME_OFFER_PUBLIC_COPY.es.signupPrompt,
          benefits: WELCOME_OFFER_PUBLIC_COPY.es.benefits,
        }}
      />

      <div className="mt-5 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <Suspense fallback={<SignUpFormSkeleton />}>
          <SignUpForm
            copy={signUpCopy}
            loginHref="/es/login"
            turnstileSiteKey={turnstileSiteKey}
          />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">
        Al crear una cuenta aceptas nuestros{" "}
        <Link href="/es/terms" className="underline transition-colors hover:text-primary">
          Términos de servicio
        </Link>{" "}
        y nuestra{" "}
        <Link href="/es/privacy" className="underline transition-colors hover:text-primary">
          Política de privacidad
        </Link>
        .
      </p>
    </SignupPageShell>
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

import type { PropertyAgentSocialProvider } from "@/features/property-showcase/types";

type PropertySocialBrand = PropertyAgentSocialProvider | "whatsapp";

interface PropertySocialBrandIconProps {
  provider: PropertySocialBrand;
  className?: string;
}

// These compact, local marks use the official Simple Icons silhouettes. They keep
// external brand assets and scripts out of the public property page.
export default function PropertySocialBrandIcon({
  provider,
  className,
}: PropertySocialBrandIconProps) {
  if (provider === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" data-testid="social-icon-instagram">
        <path fill="currentColor" d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
      </svg>
    );
  }

  if (provider === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" data-testid="social-icon-facebook">
        <path fill="currentColor" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.931-1.956 1.887v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.093 24 18.1 24 12.073Z" />
      </svg>
    );
  }

  if (provider === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" data-testid="social-icon-linkedin">
        <path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V8.98h3.41v1.57h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.29ZM5.32 7.41a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.04H3.54V8.98H7.1v11.47Z" />
      </svg>
    );
  }

  if (provider === "youtube") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" data-testid="social-icon-youtube">
        <path fill="currentColor" d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.9 24 12 24 12s0-3.9-.5-5.81ZM9.6 15.57V8.43L15.87 12 9.6 15.57Z" />
      </svg>
    );
  }

  if (provider === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" data-testid="social-icon-tiktok">
        <path fill="currentColor" d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.99-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.93-3.58 3.17-5.91 3.22-1.43.08-2.86-.31-4.09-1.03-2.04-1.19-3.48-3.42-3.68-5.78-.02-.5-.03-1 0-1.5.18-1.91 1.12-3.73 2.58-4.97 1.66-1.45 3.98-2.07 6.15-1.5.02 1.48-.04 2.96-.04 4.44-1.16-.38-2.49-.29-3.57.25-.78.37-1.47.98-1.91 1.74-.45.78-.67 1.69-.65 2.59.04 1.45.76 2.85 1.93 3.71 1.08.83 2.58 1.17 3.9.84.88-.22 1.69-.74 2.25-1.45.46-.58.79-1.27.86-2.02.12-1.79.07-3.58.08-5.38.01-4.03-.01-8.05.02-12.08Z" />
      </svg>
    );
  }

  if (provider === "whatsapp") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" data-testid="social-icon-whatsapp">
        <path fill="currentColor" d="M20.52 3.48A11.82 11.82 0 0 0 12.06 0C5.55 0 .25 5.3.25 11.8c0 2.08.54 4.1 1.58 5.94L.15 23.89l6.34-1.66a11.86 11.86 0 0 0 5.56 1.42h.01c6.5 0 11.8-5.3 11.8-11.8 0-3.15-1.23-6.11-3.34-8.37Zm-8.46 18.3h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.38a9.87 9.87 0 0 1-1.51-5.26C2.17 6.45 6.6 2.02 12.05 2.02c2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c0 5.44-4.44 9.88-9.88 9.88Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      </svg>
    );
  }

  if (provider === "x") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" data-testid="social-icon-x">
        <path fill="currentColor" d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
      </svg>
    );
  }

  if (provider === "pinterest") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" data-testid="social-icon-pinterest">
        <path fill="currentColor" d="M12 0a12 12 0 0 0-4.38 23.17c-.06-1.82-.01-4 .65-5.59l1.43-6.06s-.36-.72-.36-1.78c0-1.67.97-2.92 2.17-2.92 1.02 0 1.51.77 1.51 1.69 0 1.03-.66 2.57-.99 4-.28 1.2.6 2.18 1.78 2.18 2.14 0 3.79-2.26 3.79-5.53 0-2.89-2.08-4.91-5.05-4.91-3.44 0-5.46 2.58-5.46 5.25 0 1.04.4 2.15.9 2.75.1.12.11.22.08.34l-.34 1.38c-.05.22-.18.27-.42.16-1.56-.73-2.54-3.01-2.54-4.85 0-3.95 2.87-7.58 8.27-7.58 4.34 0 7.72 3.09 7.72 7.22 0 4.31-2.72 7.78-6.5 7.78-1.27 0-2.47-.66-2.88-1.44l-.78 2.98c-.28 1.08-1.04 2.43-1.55 3.25A12 12 0 1 0 12 0Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" data-testid="social-icon-custom">
      <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.92 9h-3.05a15.73 15.73 0 0 0-1.2-5.04A8.03 8.03 0 0 1 18.92 11ZM12 4c.83 1.2 1.54 3.12 1.82 5H10.18C10.46 7.12 11.17 5.2 12 4ZM9.33 5.96A15.73 15.73 0 0 0 8.13 11H5.08a8.03 8.03 0 0 1 4.25-5.04ZM5.08 13h3.05a15.73 15.73 0 0 0 1.2 5.04A8.03 8.03 0 0 1 5.08 13Zm6.92 7c-.83-1.2-1.54-3.12-1.82-5h3.64c-.28 1.88-.99 3.8-1.82 5Zm2.67-1.96A15.73 15.73 0 0 0 15.87 13h3.05a8.03 8.03 0 0 1-4.25 5.04Z" />
    </svg>
  );
}

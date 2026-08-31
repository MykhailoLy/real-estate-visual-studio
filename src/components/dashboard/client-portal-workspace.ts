/**
 * Shared horizontal rhythm for authenticated client-portal workspaces.
 * Public-site containers intentionally use their own layout system.
 */
export const CLIENT_PORTAL_WORKSPACE_WIDTH_CLASSNAME =
  "mx-auto w-full max-w-[1800px]";

export const CLIENT_PORTAL_WORKSPACE_GUTTERS_CLASSNAME =
  "px-4 sm:px-5 lg:px-6 2xl:px-8 min-[1920px]:px-10";

export const CLIENT_PORTAL_WORKSPACE_HORIZONTAL_CLASSNAME =
  `${CLIENT_PORTAL_WORKSPACE_WIDTH_CLASSNAME} ${CLIENT_PORTAL_WORKSPACE_GUTTERS_CLASSNAME}`;

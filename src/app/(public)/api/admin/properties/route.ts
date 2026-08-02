import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import { PropertyShowcaseMutationSchema } from "@/features/property-showcase/schema";
import { mergePropertyShowcaseUpdate } from "@/features/property-showcase/updates";

export const runtime = "nodejs";

function firstValidationMessage(error: ReturnType<typeof PropertyShowcaseMutationSchema.safeParse>) {
  if (error.success) return "Invalid request.";
  return (
    Object.values(error.error.flatten().fieldErrors)
      .flat()
      .find((message): message is string => Boolean(message)) ??
    "Invalid request."
  );
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PropertyShowcaseMutationSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstValidationMessage(parsed), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const publishedAt = parsed.data.published
    ? new Date().toISOString()
    : undefined;
  const normalized = mergePropertyShowcaseUpdate(
    null,
    {
      ...parsed.data.property,
      publishedAt,
    },
    "replace",
  );

  if (!normalized.ok || !normalized.property) {
    return NextResponse.json(
      { error: normalized.errors[0] ?? "Invalid property provider URL." },
      { status: 400 },
    );
  }

  const property = normalized.property;

  let supabase;
  try {
    supabase = createServerClient();
  } catch (error) {
    console.error("property-showcase: supabase init failed", error);
    return NextResponse.json(
      { error: "Server is not configured for property admin." },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("property_showcases")
    .insert({
      slug: property.slug,
      content: property,
      published: parsed.data.published,
      published_at: publishedAt ?? null,
    })
    .select("id, slug, published, published_at, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("property-showcase: insert failed", { code: error?.code });
    const status = error?.code === "23505" ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409
            ? "A property with this slug already exists."
            : "Could not save property showcase.",
      },
      { status },
    );
  }

  revalidatePath(`/property/${property.slug}`);

  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}

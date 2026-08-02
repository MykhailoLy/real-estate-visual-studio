import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PropertyShowcaseMutationSchema,
  PropertyShowcaseSchema,
} from "@/features/property-showcase/schema";
import { propertyShowcaseMediaDeletionCandidates } from "@/features/property-showcase/storage-cleanup";
import { mergePropertyShowcaseUpdate } from "@/features/property-showcase/updates";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deleteSiteMediaFiles } from "@/lib/site-media-server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const IdSchema = z.string().uuid();

async function getExisting(id: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("property_showcases")
    .select("id, slug, content, published_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("property-showcase: load existing failed", {
      code: error.code,
    });
    return null;
  }

  return data as
    | { id: string; slug: string; content: unknown; published_at: string | null }
    | null;
}

function validationMessage(
  parsed: ReturnType<typeof PropertyShowcaseMutationSchema.safeParse>,
): string {
  if (parsed.success) return "Invalid request.";
  return (
    Object.values(parsed.error.flatten().fieldErrors)
      .flat()
      .find((message): message is string => Boolean(message)) ??
    "Invalid request."
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idResult = IdSchema.safeParse((await context.params).id);
  if (!idResult.success) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
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
      { error: validationMessage(parsed), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let existing;
  try {
    existing = await getExisting(idResult.data);
  } catch (error) {
    console.error("property-showcase: supabase init failed", error);
    return NextResponse.json(
      { error: "Server is not configured for property admin." },
      { status: 500 },
    );
  }

  if (!existing) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const existingProperty = PropertyShowcaseSchema.safeParse(existing.content);
  if (!existingProperty.success) {
    return NextResponse.json(
      { error: "Stored property content is invalid." },
      { status: 500 },
    );
  }

  const publishedAt = parsed.data.published
    ? existing.published_at ?? new Date().toISOString()
    : undefined;
  const merged = mergePropertyShowcaseUpdate(
    existingProperty.data,
    {
      ...parsed.data.property,
      publishedAt,
    },
    parsed.data.updateMode ?? "details",
    {
      removeVirtualTour: parsed.data.removeVirtualTour,
      removeInteractiveFloorPlan: parsed.data.removeInteractiveFloorPlan,
      removeFloorPlan: parsed.data.removeFloorPlan,
    },
  );

  if (!merged.ok || !merged.property) {
    return NextResponse.json(
      { error: merged.errors[0] ?? "Invalid property provider URL." },
      { status: 400 },
    );
  }

  const property = merged.property;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("property_showcases")
    .update({
      slug: property.slug,
      content: property,
      published: parsed.data.published,
      published_at: publishedAt ?? null,
    })
    .eq("id", idResult.data)
    .select("id, slug, published, published_at, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("property-showcase: update failed", { code: error?.code });
    const status = error?.code === "23505" ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409
            ? "A property with this slug already exists."
            : "Could not update property showcase.",
      },
      { status },
    );
  }

  revalidatePath(`/property/${existing.slug}`);
  revalidatePath(`/property/${property.slug}`);

  if (existingProperty.data.slug === property.slug) {
    await deleteSiteMediaFiles(
      propertyShowcaseMediaDeletionCandidates({
        existing: existingProperty.data,
        next: property,
        slug: property.slug,
      }),
    );
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idResult = IdSchema.safeParse((await context.params).id);
  if (!idResult.success) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let existing;
  try {
    existing = await getExisting(idResult.data);
  } catch (error) {
    console.error("property-showcase: supabase init failed", error);
    return NextResponse.json(
      { error: "Server is not configured for property admin." },
      { status: 500 },
    );
  }

  if (!existing) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("property_showcases")
    .delete()
    .eq("id", idResult.data);

  if (error) {
    console.error("property-showcase: delete failed", { code: error.code });
    return NextResponse.json(
      { error: "Could not delete property showcase." },
      { status: 500 },
    );
  }

  revalidatePath(`/property/${existing.slug}`);

  return NextResponse.json({ ok: true });
}

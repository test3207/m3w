import { auth } from "@/lib/auth/config";
import { createLibrary, getUserLibraries } from "@/lib/services/library.service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import { PageHeader } from "@/components/ui/page-header";
import { HStack } from "@/components/ui/stack";
import { EmptyState } from "@/components/ui/empty-state";
import { ListItem, MetadataItem } from "@/components/ui/list-item";
import Link from "next/link";
import { DeleteLibraryButton } from "@/components/features/libraries/delete-library-button";
import { LIBRARY_TEXT } from "@/locales/messages";

async function createLibraryAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const name = formData.get("name");
  const description = formData.get("description");

  if (typeof name !== "string" || name.trim().length === 0) {
    return;
  }

  const trimmedDescription =
    typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : null;

  await createLibrary(session.user.id, name.trim(), trimmedDescription);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/libraries");
}

export default async function LibrariesPageRefactored() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const libraries = await getUserLibraries(session.user.id);

  return (
    <AdaptiveLayout
      gap={16}
      className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8"
    >
      <AdaptiveSection
        id="libraries-header"
        baseSize={180}
        minSize={130}
        className="pt-4"
      >
        <div className="flex h-full flex-col justify-end">
          <PageHeader
            title={LIBRARY_TEXT.manager.pageTitle}
            description={LIBRARY_TEXT.manager.pageDescription}
          />
        </div>
      </AdaptiveSection>

      <AdaptiveSection
        id="libraries-content"
        baseSize={540}
        minSize={320}
        className="pb-4"
      >
        <div className="grid h-full gap-6 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>{LIBRARY_TEXT.manager.form.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <form action={createLibraryAction} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{LIBRARY_TEXT.manager.form.nameLabel}</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder={LIBRARY_TEXT.manager.form.namePlaceholder}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{LIBRARY_TEXT.manager.form.descriptionLabel}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder={LIBRARY_TEXT.manager.form.descriptionPlaceholder}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full">
                  {LIBRARY_TEXT.manager.form.submitLabel}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>{LIBRARY_TEXT.manager.list.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {libraries.length === 0 ? (
                <EmptyState
                  icon="📚"
                  title={LIBRARY_TEXT.manager.list.emptyTitle}
                  description={LIBRARY_TEXT.manager.list.emptyDescription}
                  action={
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/upload">
                        {LIBRARY_TEXT.manager.list.emptyActionLabel}
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul role="list" className="flex flex-col gap-2">
                  {libraries.map((library) => (
                    <li key={library.id}>
                      <ListItem
                        title={library.name}
                        description={library.description || undefined}
                        metadata={
                          <>
                            <MetadataItem
                              label={LIBRARY_TEXT.manager.list.metadataSongsLabel}
                              value={library._count.songs}
                              variant="secondary"
                            />
                            <MetadataItem
                              label={LIBRARY_TEXT.manager.list.metadataCreatedLabel}
                              value={new Date(library.createdAt).toLocaleDateString()}
                              variant="outline"
                            />
                            <MetadataItem
                              label={LIBRARY_TEXT.manager.list.metadataUpdatedLabel}
                              value={new Date(library.updatedAt).toLocaleDateString()}
                              variant="outline"
                            />
                          </>
                        }
                        actions={
                          <HStack gap="xs">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/libraries/${library.id}`}>
                                {LIBRARY_TEXT.manager.list.manageSongsCta}
                              </Link>
                            </Button>
                            <DeleteLibraryButton
                              libraryId={library.id}
                              libraryName={library.name}
                            />
                          </HStack>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </AdaptiveSection>
    </AdaptiveLayout>
  );
}

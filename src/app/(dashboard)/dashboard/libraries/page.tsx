import { auth } from "@/lib/auth/config";
import {
  createLibrary,
  deleteLibrary as deleteLibraryService,
  getUserLibraries,
} from "@/lib/services/library.service";
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

async function deleteLibraryAction(libraryId: string) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  await deleteLibraryService(libraryId, session.user.id);

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
            title="Library Manager"
            description="Create, review, and remove music libraries. Each library keeps its own metadata and songs."
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
              <CardTitle>Create a new library</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <form action={createLibraryAction} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Library name</Label>
                  <Input id="name" name="name" placeholder="Jazz Collection" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Optional notes about this library"
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Create library
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Your libraries</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {libraries.length === 0 ? (
                <EmptyState
                  icon="📚"
                  title="No libraries yet"
                  description="Use the form to create your first collection."
                  action={
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/upload">Upload Songs</Link>
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
                              label="Songs"
                              value={library._count.songs}
                              variant="secondary"
                            />
                            <MetadataItem
                              label="Created"
                              value={new Date(library.createdAt).toLocaleDateString()}
                              variant="outline"
                            />
                          </>
                        }
                        actions={
                          <HStack gap="xs">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/libraries/${library.id}`}>
                                Manage songs
                              </Link>
                            </Button>
                            <form
                              action={async () => {
                                "use server";
                                await deleteLibraryAction(library.id);
                              }}
                            >
                              <Button
                                type="submit"
                                variant="destructive"
                                size="sm"
                              >
                                Delete
                              </Button>
                            </form>
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

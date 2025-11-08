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
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { HStack, VStack } from "@/components/ui/stack";
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
  <Container as="main">
      <VStack gap="lg">
        <PageHeader
          title="Library Manager"
          description="Create, review, and remove music libraries. Each library keeps its own metadata and songs."
        />

        <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,2fr)]">
          {/* Create Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create a new library</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createLibraryAction}>
                <VStack gap="md">
                  <VStack gap="sm">
                    <Label htmlFor="name">Library name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Jazz Collection"
                      required
                    />
                  </VStack>

                  <VStack gap="sm">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Optional notes about this library"
                      rows={3}
                    />
                  </VStack>

                  <Button type="submit" className="w-full">
                    Create library
                  </Button>
                </VStack>
              </form>
            </CardContent>
          </Card>

          {/* Libraries List */}
          <Card>
            <CardHeader>
              <CardTitle>Your libraries</CardTitle>
            </CardHeader>
            <CardContent>
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
      </VStack>
    </Container>
  );
}

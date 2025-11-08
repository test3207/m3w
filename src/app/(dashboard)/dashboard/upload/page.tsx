import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getUserLibraries } from "@/lib/services/library.service";
import { UploadSongForm } from "@/components/features/upload-song-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Section } from "@/components/ui/container";
import { UI_TEXT } from "@/locales/messages";

export default async function UploadPageRefactored() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const libraries = await getUserLibraries(session.user.id);

  const libraryOptions = libraries.map((library) => ({
    id: library.id,
    name: library.name,
    description: library.description ?? null,
    songCount: library._count.songs,
  }));

  return (
    <Section
      title={UI_TEXT.uploadPage.title}
      description={UI_TEXT.uploadPage.description}
    >
      <Card>
        <CardHeader>
          <CardTitle>{UI_TEXT.uploadPage.cardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {libraryOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {UI_TEXT.uploadPage.emptyState}
            </p>
          ) : (
            <UploadSongForm libraries={libraryOptions} />
          )}
        </CardContent>
      </Card>
    </Section>
  );
}

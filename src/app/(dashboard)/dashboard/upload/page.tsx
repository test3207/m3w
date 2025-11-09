import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getUserLibraries } from "@/lib/services/library.service";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import { UploadSongForm } from "@/components/features/upload-song-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { UPLOAD_TEXT } from "@/locales/messages";

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
    <AdaptiveLayout
      gap={16}
      className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8"
    >
      <AdaptiveSection
        id="upload-header"
        baseSize={200}
        minSize={150}
        className="pt-4"
      >
        <div className="flex h-full flex-col justify-end">
          <PageHeader
            title={UPLOAD_TEXT.page.title}
            description={UPLOAD_TEXT.page.description}
          />
        </div>
      </AdaptiveSection>

      <AdaptiveSection
        id="upload-content"
        baseSize={480}
        minSize={320}
        className="pb-4"
      >
        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>{UPLOAD_TEXT.page.cardTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {libraryOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {UPLOAD_TEXT.page.emptyState}
              </p>
            ) : (
              <UploadSongForm libraries={libraryOptions} />
            )}
          </CardContent>
        </Card>
      </AdaptiveSection>
    </AdaptiveLayout>
  );
}

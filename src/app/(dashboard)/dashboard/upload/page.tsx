'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import { UploadSongForm } from "@/components/features/upload-song-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { UPLOAD_TEXT, COMMON_TEXT } from "@/locales/messages";
import { logger } from "@/lib/logger-client";
import type { Library, LibraryOption } from "@/types/models";

export default function UploadPage() {
  const router = useRouter();
  const [libraries, setLibraries] = useState<LibraryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLibraries() {
      try {
        const res = await fetch('/api/libraries');
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/signin');
            return;
          }
          throw new Error('Failed to fetch libraries');
        }
        const data = await res.json();
        const libs: Library[] = data.data || [];
        
        const libraryOptions = libs.map((library) => ({
          id: library.id,
          name: library.name,
          description: library.description ?? null,
          songCount: library._count?.songs ?? 0,
        }));
        
        setLibraries(libraryOptions);
      } catch (error) {
        logger.error('Failed to fetch libraries', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLibraries();
  }, [router]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{COMMON_TEXT.loadingLabel}</div>
      </div>
    );
  }

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
            {libraries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {UPLOAD_TEXT.page.emptyState}
              </p>
            ) : (
              <UploadSongForm libraries={libraries} />
            )}
          </CardContent>
        </Card>
      </AdaptiveSection>
    </AdaptiveLayout>
  );
}

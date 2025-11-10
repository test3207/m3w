import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdaptiveLayout, AdaptiveSection } from "@/components/layouts/adaptive-layout";
import { UploadSongForm } from "@/components/features/upload-song-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { apiClient, ApiError } from "@/lib/api/client";
import type { Library, LibraryOption } from "@/types/models";

export default function UploadPage() {
  useLocale();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [libraries, setLibraries] = useState<LibraryOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLibraries = async () => {
    try {
      const data = await apiClient.get<{ success: boolean; data: Library[] }>('/libraries');
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
      
      if (error instanceof ApiError && error.status === 401) {
        navigate('/signin');
        return;
      }
      
      toast({
        variant: "destructive",
        title: I18n.error.failedToRetrieveLibraries,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibraries();
  }, [navigate, toast]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 xs:px-5 md:px-6 lg:px-8 pt-8">
        <div className="text-center text-muted-foreground">{I18n.common.loadingLabel}</div>
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
            title={I18n.upload.page.title}
            description={I18n.upload.page.description}
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
            <CardTitle>{I18n.upload.page.cardTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {libraries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {I18n.upload.page.emptyState}
              </p>
            ) : (
              <UploadSongForm libraries={libraries} onUploadSuccess={fetchLibraries} />
            )}
          </CardContent>
        </Card>
      </AdaptiveSection>
    </AdaptiveLayout>
  );
}

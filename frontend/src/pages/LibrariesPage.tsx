import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { DeleteLibraryButton } from "@/components/features/libraries/delete-library-button";
import { I18n } from "@/locales/i18n";
import { useLocale } from "@/locales/use-locale";
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { HttpStatusCode } from "@/lib/constants/http-status";
import type { Library } from "@/types/models";

export default function LibrariesPage() {
  useLocale();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchLibraries() {
      try {
        const res = await fetch('http://localhost:4000/api/libraries', {
          credentials: 'include',
        });
        
        if (res.status === HttpStatusCode.UNAUTHORIZED) {
          navigate('/signin');
          return;
        }
        
        logger.info('Fetch libraries response', { status: res.status });
        
        if (!res.ok) {
          logger.error('Failed to fetch libraries', { status: res.status });
          toast({
            variant: "destructive",
            title: I18n.error.failedToRetrieveLibraries,
          });
          return;
        }
        
        const data = await res.json();
        setLibraries(data.data || []);
      } catch (error) {
        logger.error('Failed to fetch libraries', error);
        toast({
          variant: "destructive",
          title: I18n.error.genericTryAgain,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchLibraries();
  }, [navigate, toast]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    try {
      const res = await fetch('http://localhost:4000/api/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        logger.error('Failed to create library', { status: res.status });
        toast({
          variant: "destructive",
          title: I18n.error.failedToCreateLibrary,
        });
        return;
      }

      const data = await res.json();
      if (data.data) {
        setLibraries(prev => [...prev, data.data]);
      }
      
      event.currentTarget.reset();
      toast({
        title: "Library created successfully",
      });
    } catch (error) {
      logger.error('Failed to create library', error);
      toast({
        variant: "destructive",
        title: I18n.error.failedToCreateLibrary,
      });
    } finally {
      setSubmitting(false);
    }
  };

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
        id="libraries-header"
        baseSize={180}
        minSize={130}
        className="pt-4"
      >
        <div className="flex h-full flex-col justify-end">
          <PageHeader
            title={I18n.library.manager.pageTitle}
            description={I18n.library.manager.pageDescription}
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
              <CardTitle>{I18n.library.manager.form.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{I18n.library.manager.form.nameLabel}</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder={I18n.library.manager.form.namePlaceholder}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{I18n.library.manager.form.descriptionLabel}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder={I18n.library.manager.form.descriptionPlaceholder}
                    rows={3}
                    disabled={submitting}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? I18n.common.creatingLabel : I18n.library.manager.form.submitLabel}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>{I18n.library.manager.list.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {libraries.length === 0 ? (
                <EmptyState
                  icon="📚"
                  title={I18n.library.manager.list.emptyTitle}
                  description={I18n.library.manager.list.emptyDescription}
                  action={
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/dashboard/upload">
                        {I18n.library.manager.list.emptyActionLabel}
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
                              label={I18n.library.manager.list.metadataSongsLabel}
                              value={library._count?.songs ?? 0}
                              variant="secondary"
                            />
                            <MetadataItem
                              label={I18n.library.manager.list.metadataCreatedLabel}
                              value={new Date(library.createdAt).toLocaleDateString()}
                              variant="outline"
                            />
                            <MetadataItem
                              label={I18n.library.manager.list.metadataUpdatedLabel}
                              value={new Date(library.updatedAt).toLocaleDateString()}
                              variant="outline"
                            />
                          </>
                        }
                        actions={
                          <HStack gap="xs">
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/dashboard/libraries/${library.id}`}>
                                {I18n.library.manager.list.manageSongsCta}
                              </Link>
                            </Button>
                            <DeleteLibraryButton
                              libraryId={library.id}
                              libraryName={library.name}
                              onDeleted={() => setLibraries(prev => prev.filter(l => l.id !== library.id))}
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

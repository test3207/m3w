'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { LIBRARY_TEXT, COMMON_TEXT, ERROR_MESSAGES } from "@/locales/messages";
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { HttpStatusCode } from "@/lib/constants/http-status";
import type { Library } from "@/types/models";

export default function LibrariesPageRefactored() {
  const router = useRouter();
  const { toast } = useToast();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchLibraries() {
      try {
        const res = await fetch('/api/libraries');
        
        if (res.status === HttpStatusCode.UNAUTHORIZED) {
          router.push('/signin');
          return;
        }
        
        logger.info('Fetch libraries response', { status: res.status });
        
        if (!res.ok) {
          logger.error('Failed to fetch libraries', { status: res.status });
          toast({
            variant: "destructive",
            title: ERROR_MESSAGES.failedToRetrieveLibraries,
          });
          return;
        }
        
        const data = await res.json();
        setLibraries(data.data || []);
      } catch (error) {
        logger.error('Failed to fetch libraries', error);
        toast({
          variant: "destructive",
          title: ERROR_MESSAGES.genericTryAgain,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchLibraries();
  }, [router, toast]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    try {
      const res = await fetch('/api/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        logger.error('Failed to create library', { status: res.status });
        toast({
          variant: "destructive",
          title: ERROR_MESSAGES.failedToCreateLibrary,
        });
        return;
      }

      const data = await res.json();
      if (data.data) {
        setLibraries(prev => [...prev, data.data]);
      }
      
      event.currentTarget.reset();
    } catch (error) {
      logger.error('Failed to create library', error);
      toast({
        variant: "destructive",
        title: ERROR_MESSAGES.failedToCreateLibrary,
      });
    } finally {
      setSubmitting(false);
    }
  };

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
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{LIBRARY_TEXT.manager.form.nameLabel}</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder={LIBRARY_TEXT.manager.form.namePlaceholder}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{LIBRARY_TEXT.manager.form.descriptionLabel}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder={LIBRARY_TEXT.manager.form.descriptionPlaceholder}
                    rows={3}
                    disabled={submitting}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? COMMON_TEXT.creatingLabel : LIBRARY_TEXT.manager.form.submitLabel}
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
                              value={library._count?.songs ?? 0}
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

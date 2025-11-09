import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListItem, MetadataItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { COMMON_TEXT, DASHBOARD_TEXT } from "@/locales/messages";
import { Plus } from "lucide-react";
import type { Library, Playlist } from "@/types/models";

interface LibrariesCardProps {
  libraries: Library[];
}

export function LibrariesCard({ libraries }: LibrariesCardProps) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <span className="text-2xl" aria-hidden="true">
              {DASHBOARD_TEXT.cards.libraries.titleIcon}
            </span>
            {DASHBOARD_TEXT.cards.libraries.titleSuffix}
          </CardTitle>
          <Button variant="outline" size="icon" asChild>
            <Link
              href="/dashboard/libraries"
              aria-label={DASHBOARD_TEXT.cards.libraries.createLabel}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">
                {DASHBOARD_TEXT.cards.libraries.createLabel}
              </span>
            </Link>
          </Button>
        </div>
        <CardDescription>
          {DASHBOARD_TEXT.cards.libraries.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {libraries.length === 0 ? (
          <EmptyState
            icon="🎵"
            title={DASHBOARD_TEXT.cards.libraries.emptyTitle}
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/libraries">
                  {DASHBOARD_TEXT.cards.libraries.emptyActionLabel}
                </Link>
              </Button>
            }
          />
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            {libraries.map((library) => (
              <li key={library.id}>
                <Link
                  href={`/dashboard/libraries/${library.id}`}
                  className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <ListItem
                    interactive
                    className="transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background"
                    title={library.name}
                    description={library.description || undefined}
                    metadata={
                      <MetadataItem
                        label={COMMON_TEXT.songsLabel}
                        value={library._count?.songs ?? 0}
                        variant="secondary"
                      />
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface PlaylistsCardProps {
  playlists: Playlist[];
}

export function PlaylistsCard({ playlists }: PlaylistsCardProps) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <span className="text-2xl" aria-hidden="true">
              {DASHBOARD_TEXT.cards.playlists.titleIcon}
            </span>
            {DASHBOARD_TEXT.cards.playlists.titleSuffix}
          </CardTitle>
          <Button variant="outline" size="icon" asChild>
            <Link
              href="/dashboard/playlists"
              aria-label={DASHBOARD_TEXT.cards.playlists.createLabel}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">
                {DASHBOARD_TEXT.cards.playlists.createLabel}
              </span>
            </Link>
          </Button>
        </div>
        <CardDescription>
          {DASHBOARD_TEXT.cards.playlists.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {playlists.length === 0 ? (
          <EmptyState
            icon="📻"
            title={DASHBOARD_TEXT.cards.playlists.emptyTitle}
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/playlists">
                  {DASHBOARD_TEXT.cards.playlists.emptyActionLabel}
                </Link>
              </Button>
            }
          />
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <Link
                  href={`/dashboard/playlists/${playlist.id}`}
                  className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <ListItem
                    interactive
                    className="transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background"
                    title={playlist.name}
                    description={playlist.description || undefined}
                    metadata={
                      <MetadataItem
                        label={COMMON_TEXT.songsLabel}
                        value={playlist._count?.songs ?? 0}
                        variant="outline"
                      />
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function StorageCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">
            {DASHBOARD_TEXT.cards.storage.titleIcon}
          </span>
          {DASHBOARD_TEXT.cards.storage.titleSuffix}
        </CardTitle>
        <CardDescription>
          {DASHBOARD_TEXT.cards.storage.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {DASHBOARD_TEXT.cards.storage.placeholder}
        </div>
      </CardContent>
    </Card>
  );
}

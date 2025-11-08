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
import { UI_TEXT } from "@/locales/messages";
import { Plus } from "lucide-react";

interface Library {
  id: string;
  name: string;
  description: string | null;
  _count: { songs: number };
}

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
              {UI_TEXT.dashboard.librariesCard.title}
            </span>
            {UI_TEXT.dashboard.librariesCard.titleSuffix}
          </CardTitle>
          <Button variant="outline" size="icon" asChild>
            <Link
              href="/dashboard/libraries"
              aria-label={UI_TEXT.dashboard.librariesCard.createLabel}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">
                {UI_TEXT.dashboard.librariesCard.createLabel}
              </span>
            </Link>
          </Button>
        </div>
        <CardDescription>
          {UI_TEXT.dashboard.librariesCard.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {libraries.length === 0 ? (
          <EmptyState
            icon="🎵"
            title={UI_TEXT.dashboard.librariesCard.empty}
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/libraries">Create Library</Link>
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
                        label="Songs"
                        value={library._count.songs}
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

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  _count: { songs: number };
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
              {UI_TEXT.dashboard.playlistsCard.title}
            </span>
            {UI_TEXT.dashboard.playlistsCard.titleSuffix}
          </CardTitle>
          <Button variant="outline" size="icon" asChild>
            <Link
              href="/dashboard/playlists"
              aria-label={UI_TEXT.dashboard.playlistsCard.createLabel}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">
                {UI_TEXT.dashboard.playlistsCard.createLabel}
              </span>
            </Link>
          </Button>
        </div>
        <CardDescription>
          {UI_TEXT.dashboard.playlistsCard.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {playlists.length === 0 ? (
          <EmptyState
            icon="📻"
            title={UI_TEXT.dashboard.playlistsCard.empty}
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/playlists">Create Playlist</Link>
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
                        label="Songs"
                        value={playlist._count.songs}
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
            {UI_TEXT.dashboard.storageCard.title}
          </span>
          {UI_TEXT.dashboard.storageCard.titleSuffix}
        </CardTitle>
        <CardDescription>
          {UI_TEXT.dashboard.storageCard.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {UI_TEXT.dashboard.storageCard.placeholder}
        </div>
      </CardContent>
    </Card>
  );
}

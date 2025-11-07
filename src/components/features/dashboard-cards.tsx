import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VStack } from "@/components/ui/stack";
import { ListItem, MetadataItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { UI_TEXT } from "@/locales/messages";

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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">
            {UI_TEXT.dashboard.librariesCard.title}
          </span>
          {UI_TEXT.dashboard.librariesCard.titleSuffix}
        </CardTitle>
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
                <ListItem
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">
            {UI_TEXT.dashboard.playlistsCard.title}
          </span>
          {UI_TEXT.dashboard.playlistsCard.titleSuffix}
        </CardTitle>
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
                <ListItem
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function GettingStartedCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">
            {UI_TEXT.dashboard.gettingStartedCard.title}
          </span>
          {UI_TEXT.dashboard.gettingStartedCard.titleSuffix}
        </CardTitle>
        <CardDescription>
          {UI_TEXT.dashboard.gettingStartedCard.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VStack gap="md">
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {UI_TEXT.dashboard.gettingStartedCard.createLibraryTitle}
              </CardTitle>
              <CardDescription>
                {UI_TEXT.dashboard.gettingStartedCard.createLibraryDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="secondary" size="sm" asChild>
                <Link href="/dashboard/libraries">
                  {UI_TEXT.dashboard.gettingStartedCard.createLibraryButton}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {UI_TEXT.dashboard.gettingStartedCard.buildPlaylistTitle}
              </CardTitle>
              <CardDescription>
                {UI_TEXT.dashboard.gettingStartedCard.buildPlaylistDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/playlists">
                  {UI_TEXT.dashboard.gettingStartedCard.buildPlaylistButton}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {UI_TEXT.dashboard.gettingStartedCard.offlineTitle}
              </CardTitle>
              <CardDescription>
                {UI_TEXT.dashboard.gettingStartedCard.offlineDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="ghost" size="sm">
                {UI_TEXT.dashboard.gettingStartedCard.offlineButton}
              </Button>
            </CardContent>
          </Card>
        </VStack>
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

export function QuickActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks to help you get started</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/dashboard/upload">
              {UI_TEXT.dashboard.quickActions.upload}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/libraries">
              {UI_TEXT.dashboard.quickActions.manageLibraries}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/playlists">
              {UI_TEXT.dashboard.quickActions.buildPlaylists}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

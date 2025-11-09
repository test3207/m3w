"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/config";
import { deleteLibrary as deleteLibraryService } from "@/lib/services/library.service";
import { logger } from "@/lib/logger";

export type DeleteLibraryActionResult = {
  status: "success" | "error";
  message: "deleted" | "not-authorized" | "unknown-error";
};

export async function deleteLibraryAction(libraryId: string): Promise<DeleteLibraryActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  if (!libraryId) {
    return { status: "error", message: "unknown-error" };
  }

  try {
    const result = await deleteLibraryService(libraryId, session.user.id);

    if (!result) {
      return { status: "error", message: "not-authorized" };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/libraries");

    return { status: "success", message: "deleted" };
  } catch (error) {
    logger.error({ msg: "Failed to delete library", libraryId, userId: session.user.id, error });
    return { status: "error", message: "unknown-error" };
  }
}

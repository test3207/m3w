import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { Library } from '@/types/models';

export const LIBRARIES_QUERY_KEY = ['libraries'] as const;

/**
 * Fetch all libraries for the current user
 */
export function useLibraries() {
  return useQuery({
    queryKey: LIBRARIES_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Library[] }>('/libraries');
      return response.data; // Extract data array from response wrapper
    },
    staleTime: 60000, // Consider data fresh for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
  });
}

/**
 * Fetch a single library by ID
 */
export function useLibrary(id: string) {
  return useQuery({
    queryKey: ['library', id] as const,
    queryFn: () => apiClient.get<Library>(`/libraries/${id}`),
    enabled: !!id, // Only run if ID is provided
    staleTime: 60000,
  });
}

/**
 * Create a new library
 */
export function useCreateLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiClient.post<Library>('/libraries', data),
    onSuccess: (newLibrary) => {
      // Update the libraries cache
      queryClient.setQueryData<Library[]>(LIBRARIES_QUERY_KEY, (old = []) => [
        ...old,
        newLibrary,
      ]);
    },
  });
}

/**
 * Update an existing library
 */
export function useUpdateLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; description?: string }) =>
      apiClient.put<Library>(`/libraries/${id}`, data),
    onSuccess: (updatedLibrary) => {
      // Update the single library cache
      queryClient.setQueryData(['library', updatedLibrary.id], updatedLibrary);

      // Update the library in the list
      queryClient.setQueryData<Library[]>(LIBRARIES_QUERY_KEY, (old = []) =>
        old.map((lib) => (lib.id === updatedLibrary.id ? updatedLibrary : lib))
      );
    },
  });
}

/**
 * Delete a library
 */
export function useDeleteLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/libraries/${id}`),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['library', deletedId] });

      // Update the libraries list
      queryClient.setQueryData<Library[]>(LIBRARIES_QUERY_KEY, (old = []) =>
        old.filter((lib) => lib.id !== deletedId)
      );
    },
  });
}

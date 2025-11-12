import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api-config';
import type { Library, ApiResponse } from '@m3w/shared';

export const LIBRARIES_QUERY_KEY = ['libraries'] as const;

/**
 * Fetch all libraries for the current user
 */
export function useLibraries() {
  return useQuery({
    queryKey: LIBRARIES_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Library[]>>(API_ENDPOINTS.libraries.list);
      return response.data ?? []; // Return empty array if data is undefined
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
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Library>>(API_ENDPOINTS.libraries.detail(id));
      return response.data;
    },
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
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiClient.post<ApiResponse<Library>>(API_ENDPOINTS.libraries.create, data);
      return response.data!;
    },
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
    mutationFn: async ({ id, ...data }: { id: string; name: string; description?: string }) => {
      const response = await apiClient.put<ApiResponse<Library>>(API_ENDPOINTS.libraries.update(id), data);
      return response.data!;
    },
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
    mutationFn: async (id: string) => {
      await apiClient.delete<ApiResponse<void>>(API_ENDPOINTS.libraries.delete(id));
      return id;
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['library', deletedId] });

      // Update the libraries list
      queryClient.setQueryData<Library[]>(LIBRARIES_QUERY_KEY, (old = []) =>
        old.filter((lib) => lib.id !== deletedId)
      );
    },
  });
}


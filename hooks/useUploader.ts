// hooks/useUploader.ts
import {useState} from 'react';
import {supabase} from '@/backend/server/lib/supabase';

export const useUploader = (bucketName: string) => {
    const [isUploading, setIsUploading] = useState(false);

    /**
     * Funkcja, która wgrywa plik (jako Blob) do Supabase Storage.
     * @param file - Plik do wgrania w formacie Blob.
     * @param filePath - Ścieżka, pod którą plik ma być zapisany w buckecie.
     * @returns Publiczny URL do wgranego pliku lub undefined w przypadku błędu.
     */
    const upload = async (file: Blob, filePath: string): Promise<string | undefined> => {
        setIsUploading(true);
        try {
            const {data, error} = await supabase.storage
                .from(bucketName)
                .upload(filePath, file, {
                    contentType: file.type || 'image/jpeg',
                    upsert: true,
                });

            if (error) {
                throw error;
            }

            const {data: {publicUrl}} = supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);

            return publicUrl;

        } catch (error) {
            console.error(`Error uploading to bucket "${bucketName}":`, error);
            return undefined;
        } finally {
            setIsUploading(false);
        }
    };

    return {isUploading, upload};
};

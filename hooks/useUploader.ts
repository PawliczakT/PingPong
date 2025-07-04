// hooks/useUploader.ts
import {useState} from 'react';
import {supabase} from '@/app/lib/supabase';

export const useUploader = (bucketName: string) => {
    const [isUploading, setIsUploading] = useState(false);

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

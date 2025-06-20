// hooks/useImageUpload.ts
import {useCallback, useEffect, useState} from 'react';
import {Alert} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {supabase} from '@/backend/server/lib/supabase';
import {Player} from '@/backend/types';
import {User} from '@supabase/supabase-js';

interface UseImageUploadReturn {
    isUploadingImage: boolean;
    pickAndUploadImage: () => Promise<void>;
}

export const useImageUpload = (
    currentPlayer: Player | null,
    user: User | null,
    onSuccess?: (avatarUrl: string) => void
): UseImageUploadReturn => {
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // ✅ Cleanup na unmount
    useEffect(() => {
        return () => {
            setIsUploadingImage(false);
        };
    }, []);

    const uploadImageToSupabase = useCallback(async (uri: string): Promise<string> => {
        if (!currentPlayer?.id || !user?.id) {
            throw new Error('User profile not found');
        }

        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const fileName = `avatar-${currentPlayer.id}-${Date.now()}.${fileExt}`;

        const {data, error} = await supabase.storage
            .from('avatars')
            .upload(fileName, arrayBuffer, {
                contentType: `image/${fileExt}`,
                upsert: true
            });

        if (error) {
            console.error('Upload error:', error);
            throw error;
        }

        const {data: {publicUrl}} = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        const {error: updateError} = await supabase
            .from('players')
            .update({avatar_url: publicUrl})
            .eq('id', currentPlayer.id);

        if (updateError) {
            console.error('Profile update error:', updateError);
            throw updateError;
        }

        return publicUrl;
    }, [currentPlayer?.id, user?.id]);

    const pickAndUploadImage = useCallback(async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    'Permission Required',
                    'Please allow access to your photo library to upload a profile picture.',
                    [{text: 'OK'}]
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
                base64: false,
            });

            if (result.canceled || !result.assets?.[0]?.uri) {
                return;
            }

            setIsUploadingImage(true);
            const avatarUrl = await uploadImageToSupabase(result.assets[0].uri);

            Alert.alert('Success', 'Profile picture updated successfully!');
            onSuccess?.(avatarUrl);

        } catch (error) {
            console.error('Error uploading avatar:', error);
            Alert.alert(
                'Upload Failed',
                (error as Error)?.message || 'Failed to update avatar. Please try again.'
            );
        } finally {
            setIsUploadingImage(false);
        }
    }, [uploadImageToSupabase, onSuccess]);

    return {
        isUploadingImage,
        pickAndUploadImage
    };
};

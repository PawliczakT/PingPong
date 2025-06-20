// hooks/useImageUpload.ts
import {useCallback, useEffect, useState} from 'react';
import {Alert, Platform} from 'react-native';
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

    useEffect(() => {
        return () => {
            setIsUploadingImage(false);
        };
    }, []);

    const uploadImageToSupabase = useCallback(async (uri: string): Promise<string> => {
        if (!currentPlayer?.id || !user?.id) {
            throw new Error('User profile not found');
        }

        try {
            const response = await fetch(uri);

            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }

            const blob = await response.blob();

            // ✅ Poprawione wykrywanie formatu pliku
            let fileExt = 'jpg'; // Default fallback

            // Pierwszy sprawdź MIME type z blob
            if (blob.type) {
                const mimeType = blob.type.toLowerCase();
                if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
                    fileExt = 'jpg';
                } else if (mimeType.includes('png')) {
                    fileExt = 'png';
                } else if (mimeType.includes('webp')) {
                    fileExt = 'webp';
                } else if (mimeType.includes('gif')) {
                    fileExt = 'gif';
                } else {
                    console.log('🔍 Detected MIME type:', mimeType);
                    if (!mimeType.startsWith('image/')) {
                        throw new Error('Selected file is not an image. Please choose an image file.');
                    }
                    fileExt = 'jpg';
                }
            } else {
                const uriExt = uri.split('.').pop()?.toLowerCase();
                if (uriExt && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(uriExt)) {
                    fileExt = uriExt === 'jpeg' ? 'jpg' : uriExt;
                }
            }

            console.log('🔍 File format detected:', fileExt, 'MIME type:', blob.type);

            // ✅ Sprawdź rozmiar pliku
            if (blob.size > 5 * 1024 * 1024) { // 5MB limit
                throw new Error('Image too large. Please choose a smaller image (max 5MB).');
            }

            const arrayBuffer = await blob.arrayBuffer();
            const fileName = `avatar-${currentPlayer.id}-${Date.now()}.${fileExt}`;

            const {data, error} = await supabase.storage
                .from('avatars')
                .upload(fileName, arrayBuffer, {
                    contentType: blob.type || `image/${fileExt}`, // ✅ Użyj MIME type z blob
                    upsert: true,
                    cacheControl: '3600'
                });

            if (error) {
                console.error('Upload error:', error);
                throw new Error(`Upload failed: ${error.message}`);
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
                throw new Error(`Failed to update profile: ${updateError.message}`);
            }

            return publicUrl;
        } catch (error) {
            console.error('Avatar upload error:', error);
            throw error;
        }
    }, [currentPlayer?.id, user?.id]);

    const pickAndUploadImage = useCallback(async () => {
        try {
            // ✅ Różne podejście dla web i mobile
            let result;

            if (Platform.OS === 'web') {
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                    base64: false,
                    // ✅ Web-specific options
                    allowsMultipleSelection: false,
                });
            } else {
                const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

                if (!permissionResult.granted) {
                    Alert.alert(
                        'Permission Required',
                        'Please allow access to your photo library to upload a profile picture.',
                        [{text: 'OK'}]
                    );
                    return;
                }

                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.7,
                    base64: false,
                });
            }

            if (result.canceled || !result.assets?.[0]?.uri) {
                return;
            }

            console.log('🔍 Selected image:', {
                uri: result.assets[0].uri,
                type: result.assets[0].type,
                fileSize: result.assets[0].fileSize
            });

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

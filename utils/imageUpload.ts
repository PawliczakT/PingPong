import * as ImagePicker from 'expo-image-picker';
import {supabase} from '@/lib/supabase';
import {decode} from 'base64-arraybuffer';

interface ImageUploadResult {
    url: string | null;
    error: string | null;
}

/**
 * Request permissions to access the user's media library
 */
export const requestMediaLibraryPermissions = async (): Promise<boolean> => {
    const {status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
};

/**
 * Pick an image from the device's media library
 */
export const pickImage = async (): Promise<ImagePicker.ImagePickerResult> => {
    // Request permissions first
    const permissionGranted = await requestMediaLibraryPermissions();
    if (!permissionGranted) {
        return {canceled: true, assets: null};
    }

    // Launch image picker with the stable API that works
    try {
        return await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1], // Square aspect ratio for avatars
            quality: 0.8,
            base64: true, // Get base64 for upload
        });
    } catch (error) {
        console.error('Image picker error:', error);
        throw error;
    }
};

/**
 * Upload an image to Supabase Storage and return the public URL
 */
export const uploadImageToSupabase = async (
    imageUri: string,
    base64Data: string | null,
    playerId: string
): Promise<ImageUploadResult> => {
    try {
        if (!base64Data) {
            return {url: null, error: 'No image data provided'};
        }

        // Extract file extension from URI
        const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const validExt = ['jpg', 'jpeg', 'png', 'gif'].includes(fileExt) ? fileExt : 'jpg';
        const fileName = `${playerId}_${Date.now()}.${validExt}`;

        // Convert base64 to array buffer
        const contentType = `image/${validExt === 'jpg' ? 'jpeg' : validExt}`;
        const arrayBuffer = decode(base64Data);

        console.log('Uploading image to Supabase bucket: avatars');

        // Upload to Supabase storage
        const {data, error} = await supabase.storage
            .from('avatars')
            .upload(fileName, arrayBuffer, {
                contentType,
                upsert: true,
            });

        if (error) {
            console.error('Error uploading avatar:', error.message);
            return {url: null, error: error.message};
        }

        // Get public URL
        const {data: {publicUrl}} = supabase.storage.from('avatars').getPublicUrl(fileName);
        console.log('Image uploaded successfully, public URL:', publicUrl);

        return {url: publicUrl, error: null};
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during upload';
        console.error('Avatar upload failed:', errorMessage);
        return {url: null, error: errorMessage};
    }
};

import * as ImagePicker from 'expo-image-picker';
import {Alert, Platform} from 'react-native';
import {supabase} from '@/backend/server/lib/supabase';

interface ProcessAvatarResult {
    canceled: boolean;
    uri?: string;
    base64?: string;
    awsProcessed?: boolean;
    fileName?: string;
}

export async function pickAndProcessAvatarWithAWS(): Promise<ProcessAvatarResult> {
    try {
        // Request permission to access media library
        if (Platform.OS !== 'web') {
            const {status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Required',
                    'We need access to your photo library to select an avatar image.'
                );
                return {canceled: true};
            }
        }

        // Launch image picker
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1], // Square aspect ratio for avatars
            quality: 0.8,
            base64: true, // We need base64 for AWS processing
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
            return {canceled: true};
        }

        const asset = result.assets[0];

        if (!asset.base64) {
            console.warn('No base64 data available, using original image');
            return {
                canceled: false,
                uri: asset.uri,
                awsProcessed: false
            };
        }

        // Generate a filename for the image
        const fileName = `avatar_${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`;

        try {
            console.log('AWS recognition: selectedImageUri', asset.uri);
            console.log('AWS recognition: base64 length', asset.base64?.length);

            // Call Supabase Edge Function to process the image with AWS
            const {data: functionData, error: functionError} = await supabase.functions.invoke(
                'process-avatar',
                {
                    body: {
                        imageBase64: asset.base64,
                        fileName: fileName,
                        playerId: `temp_${Date.now()}`
                    }
                }
            );

            console.log('Supabase function response:', functionData);

            if (functionError) {
                console.error('Supabase function error:', functionError);
                throw new Error(`Function error: ${functionError.message}`);
            }

            // Check if AWS processing was successful
            if (functionData?.success && functionData?.faceDetected) {
                console.log('AWS processing successful:', functionData.message);
                return {
                    canceled: false,
                    uri: functionData.url, // Use the processed image URL from Supabase Storage
                    base64: asset.base64, // Keep original base64 for backup
                    awsProcessed: true,
                    fileName: functionData.fileName
                };
            } else {
                // AWS didn't detect a face or processing failed, use original image
                console.log('AWS processing result:', functionData?.message || 'No face detected');
                return {
                    canceled: false,
                    uri: asset.uri, // Use original asset URI
                    base64: asset.base64,
                    awsProcessed: false,
                    fileName: fileName
                };
            }
        } catch (awsError) {
            console.error('AWS processing error:', awsError);

            // Fallback to original image if AWS processing fails
            return {
                canceled: false,
                uri: asset.uri, // Use original asset URI
                base64: asset.base64,
                awsProcessed: false,
                fileName: fileName
            };
        }
    } catch (error) {
        console.error('Error in pickAndProcessAvatarWithAWS:', error);
        throw error;
    }
}

// Alternative version with local face detection fallback
export async function pickAndProcessAvatarWithFallback(): Promise<ProcessAvatarResult> {
    try {
        // First try AWS processing
        const awsResult = await pickAndProcessAvatarWithAWS();

        // If AWS processing failed but we have an image, try local face detection
        if (!awsResult.canceled && !awsResult.awsProcessed && awsResult.uri) {
            // Here you could implement local face detection using libraries like:
            // - expo-face-detector (deprecated but might still work)
            // - @react-native-ml-kit/face-detection
            // - Custom ML model with TensorFlow.js

            console.log('AWS processing failed, using original image');
            return awsResult;
        }

        return awsResult;
    } catch (error) {
        console.error('Error in pickAndProcessAvatarWithFallback:', error);
        throw error;
    }
}

// Utility function to validate image before processing
export function validateImageForAvatar(asset: ImagePicker.ImagePickerAsset): boolean {
    // Check file size (limit to 5MB)
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Image Too Large', 'Please select an image smaller than 5MB');
        return false;
    }

    // Check image dimensions (minimum 100x100)
    if (asset.width < 100 || asset.height < 100) {
        Alert.alert('Image Too Small', 'Please select an image at least 100x100 pixels');
        return false;
    }

    return true;
}

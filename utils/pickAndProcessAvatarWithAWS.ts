//utils/pickAndProcessAvatarWithAWS.ts
import * as ImagePicker from 'expo-image-picker';
import {Alert, Platform} from 'react-native';
import {supabase} from '@/app/lib/supabase';

interface ProcessAvatarResult {
    canceled: boolean;
    uri?: string;
    base64?: string;
    awsProcessed?: boolean;
    fileName?: string;
}

export async function pickAndProcessAvatarWithAWS(): Promise<ProcessAvatarResult> {
    try {
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

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
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

        const fileName = `avatar_${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`;

        try {
            console.log('AWS recognition: selectedImageUri', asset.uri);
            console.log('AWS recognition: base64 length', asset.base64?.length);

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

            if (functionData?.success && functionData?.faceDetected) {
                console.log('AWS processing successful:', functionData.message);
                return {
                    canceled: false,
                    uri: functionData.url,
                    base64: asset.base64,
                    awsProcessed: true,
                    fileName: functionData.fileName
                };
            } else {
                console.log('AWS processing result:', functionData?.message || 'No face detected');
                return {
                    canceled: false,
                    uri: asset.uri,
                    base64: asset.base64,
                    awsProcessed: false,
                    fileName: fileName
                };
            }
        } catch (awsError) {
            console.error('AWS processing error:', awsError);

            return {
                canceled: false,
                uri: asset.uri,
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

export async function pickAndProcessAvatarWithFallback(): Promise<ProcessAvatarResult> {
    try {
        const awsResult = await pickAndProcessAvatarWithAWS();

        if (!awsResult.canceled && !awsResult.awsProcessed && awsResult.uri) {
            console.log('AWS processing failed, using original image');
            return awsResult;
        }

        return awsResult;
    } catch (error) {
        console.error('Error in pickAndProcessAvatarWithFallback:', error);
        throw error;
    }
}

export function validateImageForAvatar(asset: ImagePicker.ImagePickerAsset): boolean {
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Image Too Large', 'Please select an image smaller than 5MB');
        return false;
    }

    if (asset.width < 100 || asset.height < 100) {
        Alert.alert('Image Too Small', 'Please select an image at least 100x100 pixels');
        return false;
    }

    return true;
}

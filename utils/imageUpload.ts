import * as ImagePicker from 'expo-image-picker';
import {supabase} from '@/lib/supabase';
import {decode} from 'base64-arraybuffer';
import * as FaceDetector from 'expo-face-detector';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';
import {Platform} from 'react-native';

interface ImageUploadResult {
    url: string | undefined;
    error: string | undefined;
}

interface ProcessAvatarResponse {
    success: boolean;
    url?: string;
    error?: string;
    faceDetected?: boolean;
    fileName?: string;
    message?: string;
}

/**
 * Sprawdza, czy jesteśmy w środowisku przeglądarki czy natywnym
 */
const isWeb = () => Platform.OS === 'web';

/**
 * Request permissions to access the user's media library
 */
export const requestMediaLibraryPermissions = async (): Promise<boolean> => {
    const {status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
};

/**
 * Detect face in an image and crop it to center on the face (fallback method)
 */
export const detectFaceAndCrop = async (imageUri: string): Promise<string> => {
    try {
        console.log('Detecting face in image using local fallback method:', imageUri);

        // W środowisku web pomijamy wykrywanie twarzy i zwracamy oryginalny obraz
        if (isWeb()) {
            console.log('Face detection not available in web environment, returning original image');
            return imageUri;
        }

        // Detect faces in the image
        const {faces} = await FaceDetector.detectFacesAsync(imageUri, {
            mode: FaceDetector.FaceDetectorMode.accurate, // Używamy trybu accurate zamiast fast
            detectLandmarks: FaceDetector.FaceDetectorLandmarks.all, // Wykrywaj wszystkie punkty charakterystyczne
            runClassifications: FaceDetector.FaceDetectorClassifications.all, // Używaj wszystkich klasyfikacji
        });

        if (faces.length > 0) {
            console.log(`Found ${faces.length} faces. Using the first one for cropping.`);
            // Use coordinates of the first detected face
            const face = faces[0];
            const {bounds} = face;
            const {origin, size} = bounds;

            // Pobierz informacje o oryginalnym obrazie za pomocą Image Manipulator
            const imageInfo = await manipulateAsync(imageUri, [], {});
            const imageWidth = imageInfo.width;
            const imageHeight = imageInfo.height;

            // Używamy większego mnożnika dla lepszego kadrowania (więcej miejsca wokół twarzy)
            const faceSize = Math.max(size.width, size.height);
            // Twarz powinna zajmować około 60-70% kadru (mnożnik 2.5-3.0)
            const cropSize = Math.round(faceSize * 3.0);

            // Wyśrodkuj kadr na twarzy, upewniając się, że nie wyjdziemy poza granice obrazu
            const centerX = origin.x + size.width / 2;
            const centerY = origin.y + size.height / 2;

            // Oblicz początek kadru (lewy górny róg)
            let originX = Math.max(0, Math.round(centerX - cropSize / 2));
            let originY = Math.max(0, Math.round(centerY - cropSize / 2));

            // Upewnij się, że kadr nie wychodzi poza granice obrazu
            let finalCropSize = cropSize;
            if (originX + cropSize > imageWidth) {
                finalCropSize = imageWidth - originX;
            }
            if (originY + cropSize > imageHeight) {
                finalCropSize = Math.min(finalCropSize, imageHeight - originY);
            }

            // Jeśli twarz jest blisko dolnej krawędzi, przesuń kadr w górę
            if (originY + finalCropSize > imageHeight - 10) {
                const shift = Math.min(originY, (originY + finalCropSize) - (imageHeight - 10));
                originY -= shift;
            }

            // Jeśli twarz jest blisko górnej krawędzi, przesuń kadr w dół
            if (originY < 10 && finalCropSize < imageHeight) {
                originY = 0;
            }

            console.log('Cropping image to center on face with dimensions:', {
                originX,
                originY,
                width: finalCropSize,
                height: finalCropSize,
                originalImageSize: `${imageWidth}x${imageHeight}`
            });

            // Wykonaj kadrowanie
            const result = await manipulateAsync(
                imageUri,
                [
                    {
                        crop: {
                            originX,
                            originY,
                            width: finalCropSize,
                            height: finalCropSize
                        }
                    }
                ],
                {format: SaveFormat.JPEG, compress: 0.8}
            );

            console.log('Face detection and cropping successful');
            return result.uri;
        }

        console.log('No faces detected in image, returning original image');
        return imageUri; // Return original image if no faces detected
    } catch (error) {
        console.error('Error in face detection:', error);
        return imageUri; // Return original image on error
    }
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
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true, // Get base64 for upload
        });
    } catch (error) {
        console.error('Image picker error:', error);
        throw error;
    }
};

/**
 * Process avatar image using Supabase Edge Function with AWS Rekognition
 */
export const processAvatarWithAWS = async (
    imageBase64: string | undefined,
    fileName: string,
    playerId: string
): Promise<ProcessAvatarResponse> => {
    if (!imageBase64) {
        return {success: false, error: 'No image data provided'};
    }

    try {
        console.log('Processing avatar with AWS Rekognition through Supabase Edge Function');

        // Supabase URL - używamy wartości bezpośrednio z .env zamiast process.env
        const SUPABASE_URL = 'https://msiemlfjcnhnwkwwpvhm.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zaWVtbGZqY25obmtrd3dwdmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODY0MDYxNzUsImV4cCI6MjAwMTk4MjE3NX0.Lbk36myTLbXH6UQ0yMAeM9sSWaB0SHqafflOKXzGkPI';

        const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-avatar`;

        // Przygotuj dane do wysłania
        const requestData = {
            imageBase64,
            fileName,
            playerId
        };

        // Wywołaj funkcję Supabase Edge Function
        const response = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(requestData)
        });

        // Sprawdź czy odpowiedź jest poprawna
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error processing avatar:', errorText);
            return {success: false, error: `Server error: ${response.status}. ${errorText}`};
        }

        // Pobierz wynik przetwarzania
        const result = await response.json();
        console.log('Avatar processing result:', result);

        return result;
    } catch (error) {
        console.error('Error in processAvatarWithAWS:', error);
        return {success: false, error: error instanceof Error ? error.message : 'Unknown error'};
    }
};

/**
 * Pick an image and process it with AWS Rekognition or fall back to local processing
 */
export const pickAndProcessAvatarWithAWS = async (): Promise<{
    uri: string | undefined;
    base64: string | undefined;
    awsProcessed: boolean;
    canceled: boolean;
}> => {
    try {
        // Pick an image first
        const pickerResult = await pickImage();

        if (pickerResult.canceled || !pickerResult.assets || !pickerResult.assets[0]) {
            return {uri: undefined, base64: undefined, awsProcessed: false, canceled: true};
        }

        const originalUri = pickerResult.assets[0].uri;
        const originalBase64 = pickerResult.assets[0].base64 || undefined;

        // Wyodrębnij nazwę pliku z URI
        const fileName = originalUri.split('/').pop() || `image_${Date.now()}.jpg`;

        // Wygeneruj tymczasowe ID gracza, jeśli nie mamy jeszcze prawdziwego ID
        const tempPlayerId = `temp_${Date.now()}`;

        try {
            // Spróbuj przetworzyć avatar przez AWS Rekognition
            const processResult = await processAvatarWithAWS(originalBase64, fileName, tempPlayerId);

            if (processResult.success && processResult.url) {
                return {
                    uri: processResult.url,
                    base64: originalBase64, // Zachowujemy oryginalny base64 do przesłania
                    awsProcessed: true,
                    canceled: false
                };
            }
        } catch (error) {
            console.log('AWS processing failed, falling back to local processing:', error);
        }

        console.log('Using local face detection as fallback');
        // Jeśli przetwarzanie AWS nie powiodło się, użyj lokalnej metody
        const processedUri = await detectFaceAndCrop(originalUri);

        // Jeśli lokalne przetwarzanie zmieniło URI, aktualizujemy dane
        let finalBase64 = originalBase64;
        if (processedUri !== originalUri && originalBase64) {
            // Konwertuj przetworzone zdjęcie do base64
            const processedResult = await manipulateAsync(
                processedUri,
                [],
                {base64: true, format: SaveFormat.JPEG}
            );
            finalBase64 = processedResult.base64 || undefined;
        }

        return {
            uri: processedUri,
            base64: finalBase64,
            awsProcessed: false,
            canceled: false
        };
    } catch (error) {
        console.error('Error in pickAndProcessAvatarWithAWS:', error);
        return {uri: undefined, base64: undefined, awsProcessed: false, canceled: true};
    }
};

/**
 * Upload an image to Supabase Storage and return the public URL
 */
export const uploadImageToSupabase = async (
    imageUri: string,
    base64Data: string | undefined,
    playerId: string
): Promise<ImageUploadResult> => {
    try {
        if (!base64Data) {
            return {url: undefined, error: 'No image data provided'};
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
            return {url: undefined, error: error.message};
        }

        // Get public URL
        const {data: {publicUrl}} = supabase.storage.from('avatars').getPublicUrl(fileName);
        console.log('Image uploaded successfully, public URL:', publicUrl);

        return {url: publicUrl, error: undefined};
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during upload';
        console.error('Avatar upload failed:', errorMessage);
        return {url: undefined, error: errorMessage};
    }
};

//utils/imageUpload.ts
import * as ImagePicker from 'expo-image-picker';
import {supabase} from '@/app/lib/supabase';
import {decode} from 'base64-arraybuffer';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';
import {Platform} from 'react-native';
import MlkitFaceDetection, {
    ContourType,
    Coutour,
    Face as MlkitFace,
    FaceDetectionOptions as MlkitFaceDetectionOptions,
    Landmark,
    LandmarkType
} from '@react-native-ml-kit/face-detection';

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

// ML Kit Face interface converted to match vision camera format
interface Face {
    pitchAngle: number;
    rollAngle: number;
    yawAngle: number;
    bounds: Bounds;
    leftEyeOpenProbability: number;
    rightEyeOpenProbability: number;
    smilingProbability: number;
    contours?: Contours;
    landmarks?: Landmarks;
}

interface Bounds {
    width: number;
    height: number;
    x: number;
    y: number;
}

interface Point {
    x: number;
    y: number;
}

interface Contours {
    FACE: Point[];
    LEFT_EYEBROW_TOP: Point[];
    LEFT_EYEBROW_BOTTOM: Point[];
    RIGHT_EYEBROW_TOP: Point[];
    RIGHT_EYEBROW_BOTTOM: Point[];
    LEFT_EYE: Point[];
    RIGHT_EYE: Point[];
    UPPER_LIP_TOP: Point[];
    UPPER_LIP_BOTTOM: Point[];
    LOWER_LIP_TOP: Point[];
    LOWER_LIP_BOTTOM: Point[];
    NOSE_BRIDGE: Point[];
    NOSE_BOTTOM: Point[];
    LEFT_CHEEK: Point[];
    RIGHT_CHEEK: Point[];
}

interface Landmarks {
    LEFT_CHEEK: Point;
    LEFT_EAR: Point;
    LEFT_EYE: Point;
    MOUTH_BOTTOM: Point;
    MOUTH_LEFT: Point;
    MOUTH_RIGHT: Point;
    NOSE_BASE: Point;
    RIGHT_CHEEK: Point;
    RIGHT_EAR: Point;
    RIGHT_EYE: Point;
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
 * Convert ML Kit face detection result to our Face interface
 */
const convertMlkitFaceToFace = (mlkitFace: MlkitFace): Face => {
    return {
        bounds: {
            x: mlkitFace.frame.left,
            y: mlkitFace.frame.top,
            width: mlkitFace.frame.width,
            height: mlkitFace.frame.height
        },
        pitchAngle: mlkitFace.rotationX || 0,
        rollAngle: mlkitFace.rotationZ || 0,
        yawAngle: mlkitFace.rotationY || 0,
        leftEyeOpenProbability: mlkitFace.leftEyeOpenProbability || 1,
        rightEyeOpenProbability: mlkitFace.rightEyeOpenProbability || 1,
        smilingProbability: mlkitFace.smilingProbability || 0.5,
        contours: mlkitFace.contours ? convertMlkitContours(mlkitFace.contours) : undefined,
        landmarks: mlkitFace.landmarks ? convertMlkitLandmarks(mlkitFace.landmarks) : undefined
    };
};

/**
 * Convert ML Kit contours to our Contours interface
 */
const convertMlkitContours = (mlkitContours: Record<ContourType, Coutour>): Contours => {
    const convertPoints = (contour: Coutour | undefined): Point[] => {
        if (!contour || !contour.points || !Array.isArray(contour.points)) return [];
        return contour.points.map(point => ({
            x: point.x || 0,
            y: point.y || 0
        }));
    };

    return {
        FACE: convertPoints(mlkitContours.face),
        LEFT_EYEBROW_TOP: convertPoints(mlkitContours.leftEyebrowTop),
        LEFT_EYEBROW_BOTTOM: convertPoints(mlkitContours.leftEyebrowBottom),
        RIGHT_EYEBROW_TOP: convertPoints(mlkitContours.rightEyebrowTop),
        RIGHT_EYEBROW_BOTTOM: convertPoints(mlkitContours.rightEyebrowBottom),
        LEFT_EYE: convertPoints(mlkitContours.leftEye),
        RIGHT_EYE: convertPoints(mlkitContours.rightEye),
        UPPER_LIP_TOP: convertPoints(mlkitContours.upperLipTop),
        UPPER_LIP_BOTTOM: convertPoints(mlkitContours.upperLipBottom),
        LOWER_LIP_TOP: convertPoints(mlkitContours.lowerLipTop),
        LOWER_LIP_BOTTOM: convertPoints(mlkitContours.lowerLipBottom),
        NOSE_BRIDGE: convertPoints(mlkitContours.noseBridge),
        NOSE_BOTTOM: convertPoints(mlkitContours.noseBottom),
        LEFT_CHEEK: convertPoints(mlkitContours.leftCheek),
        RIGHT_CHEEK: convertPoints(mlkitContours.rightCheek)
    };
};

/**
 * Convert ML Kit landmarks to our Landmarks interface
 */
const convertMlkitLandmarks = (mlkitLandmarks: Record<LandmarkType, Landmark>): Landmarks => {
    const getPoint = (landmark: Landmark | undefined): Point => ({
        x: landmark?.position?.x || 0,
        y: landmark?.position?.y || 0
    });

    return {
        LEFT_CHEEK: getPoint(mlkitLandmarks.leftCheek),
        LEFT_EAR: getPoint(mlkitLandmarks.leftEar),
        LEFT_EYE: getPoint(mlkitLandmarks.leftEye),
        MOUTH_BOTTOM: getPoint(mlkitLandmarks.mouthBottom),
        MOUTH_LEFT: getPoint(mlkitLandmarks.mouthLeft),
        MOUTH_RIGHT: getPoint(mlkitLandmarks.mouthRight),
        NOSE_BASE: getPoint(mlkitLandmarks.noseBase),
        RIGHT_CHEEK: getPoint(mlkitLandmarks.rightCheek),
        RIGHT_EAR: getPoint(mlkitLandmarks.rightEar),
        RIGHT_EYE: getPoint(mlkitLandmarks.rightEye)
    };
};

/**
 * Detect faces in static image using ML Kit
 */
const detectFacesInStaticImage = async (
    imageUri: string
): Promise<Face[]> => {
    try {
        console.log('Starting ML Kit face detection for image:', imageUri);

        // ML Kit Face Detection options
        const options: MlkitFaceDetectionOptions = {
            performanceMode: 'accurate',
            landmarkMode: 'all',
            contourMode: 'all',
            classificationMode: 'all',
            minFaceSize: 0.15,
            trackingEnabled: false
        };

        // Detect faces using ML Kit
        const mlkitFaces = await MlkitFaceDetection.detect(imageUri, options);

        console.log(`ML Kit detected ${mlkitFaces.length} faces`);

        // Convert ML Kit faces to our Face interface
        const faces: Face[] = mlkitFaces.map(convertMlkitFaceToFace);

        // Log face details for debugging
        faces.forEach((face, index) => {
            console.log(`Face ${index + 1}:`, {
                bounds: face.bounds,
                angles: {
                    pitch: face.pitchAngle,
                    roll: face.rollAngle,
                    yaw: face.yawAngle
                },
                probabilities: {
                    leftEyeOpen: face.leftEyeOpenProbability,
                    rightEyeOpen: face.rightEyeOpenProbability,
                    smiling: face.smilingProbability
                }
            });
        });

        return faces;
    } catch (error) {
        console.error('Error detecting faces with ML Kit:', error);
        return [];
    }
};

/**
 * Detect face in an image and crop it to center on the face using ML Kit
 */
export const detectFaceAndCrop = async (imageUri: string): Promise<string> => {
    try {
        console.log('Detecting face in image using ML Kit:', imageUri);

        // W środowisku web pomijamy wykrywanie twarzy i zwracamy oryginalny obraz
        if (isWeb()) {
            console.log('ML Kit face detection not available in web environment, returning original image');
            return imageUri;
        }

        // Get image dimensions
        const imageInfo = await manipulateAsync(imageUri, [], {});
        const imageWidth = imageInfo.width;
        const imageHeight = imageInfo.height;

        console.log('Image dimensions:', {width: imageWidth, height: imageHeight});

        // Detect faces using ML Kit
        const faces = await detectFacesInStaticImage(imageUri);

        if (faces && faces.length > 0) {
            console.log(`Found ${faces.length} faces. Using the first one for cropping.`);

            // Use coordinates of the first detected face
            const face = faces[0];
            const bounds = face.bounds;

            // Validate bounds
            if (bounds.width <= 0 || bounds.height <= 0) {
                console.warn('Invalid face bounds detected, returning original image');
                return imageUri;
            }

            // Calculate face center and size
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            const faceSize = Math.max(bounds.width, bounds.height);

            // Face should occupy about 60-70% of the frame (multiplier 2.5-3.0)
            const cropSize = Math.round(faceSize * 3.0);

            // Calculate crop origin (top-left corner)
            let originX = Math.max(0, Math.round(centerX - cropSize / 2));
            let originY = Math.max(0, Math.round(centerY - cropSize / 2));

            // Ensure crop doesn't exceed image boundaries
            let finalCropSize = cropSize;
            if (originX + cropSize > imageWidth) {
                finalCropSize = imageWidth - originX;
            }
            if (originY + cropSize > imageHeight) {
                finalCropSize = Math.min(finalCropSize, imageHeight - originY);
            }

            // Adjust if face is near bottom edge
            if (originY + finalCropSize > imageHeight - 10) {
                const shift = Math.min(originY, (originY + finalCropSize) - (imageHeight - 10));
                originY -= shift;
            }

            // Adjust if face is near top edge
            if (originY < 10 && finalCropSize < imageHeight) {
                originY = 0;
            }

            // Make sure crop size is square and reasonable
            finalCropSize = Math.min(finalCropSize, imageWidth - originX, imageHeight - originY);

            // Minimum crop size check
            if (finalCropSize < 50) {
                console.warn('Calculated crop size too small, returning original image');
                return imageUri;
            }

            console.log('Cropping image to center on face with dimensions:', {
                originX,
                originY,
                width: finalCropSize,
                height: finalCropSize,
                originalImageSize: `${imageWidth}x${imageHeight}`,
                faceCenter: {x: centerX, y: centerY},
                faceBounds: bounds,
                faceSize,
                cropMultiplier: finalCropSize / faceSize
            });

            // Perform cropping
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

            console.log('ML Kit face detection and cropping successful');
            return result.uri;
        }

        console.log('No faces detected in image, returning original image');
        return imageUri;
    } catch (error) {
        console.error('Error in ML Kit face detection and cropping:', error);
        return imageUri; // Return original image on error
    }
};

/**
 * Get face analysis information for debugging/logging
 */
export const analyzeFaceInImage = async (imageUri: string): Promise<{
    faceCount: number;
    faces: Face[];
    quality: {
        hasGoodLighting: boolean;
        eyesOpen: boolean;
        isSmiling: boolean;
        faceAngle: 'good' | 'tilted' | 'extreme';
    }[];
}> => {
    try {
        if (isWeb()) {
            return {faceCount: 0, faces: [], quality: []};
        }

        const faces = await detectFacesInStaticImage(imageUri);

        const quality = faces.map(face => {
            // Analyze face quality
            const eyesOpen = face.leftEyeOpenProbability > 0.5 && face.rightEyeOpenProbability > 0.5;
            const isSmiling = face.smilingProbability > 0.3;

            // Analyze face angle
            const maxAngle = Math.max(
                Math.abs(face.pitchAngle),
                Math.abs(face.rollAngle),
                Math.abs(face.yawAngle)
            );

            let faceAngle: 'good' | 'tilted' | 'extreme';
            if (maxAngle < 15) {
                faceAngle = 'good';
            } else if (maxAngle < 30) {
                faceAngle = 'tilted';
            } else {
                faceAngle = 'extreme';
            }

            return {
                hasGoodLighting: true, // ML Kit doesn't provide lighting info directly
                eyesOpen,
                isSmiling,
                faceAngle
            };
        });

        return {
            faceCount: faces.length,
            faces,
            quality
        };
    } catch (error) {
        console.error('Error analyzing face in image:', error);
        return {faceCount: 0, faces: [], quality: []};
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

    try {
        return await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
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

    if (Platform.OS !== 'web') {
        return {success: false, error: 'AWS Rekognition not available on mobile'};
    }

    try {
        console.log('Processing avatar with AWS Rekognition through Supabase Edge Function');

        const SUPABASE_URL = 'https://msiemlfjcnhnwkwwpvhm.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zaWVtbGZqY25obmtrd3dwdmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODY0MDYxNzUsImV4cCI6MjAwMTk4MjE3NX0.Lbk36myTLbXH6UQ0yMAeM9sSWaB0SHqafflOKXzGkPI';
        const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-avatar`;

        const requestData = {
            imageBase64,
            fileName,
            playerId
        };

        const response = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error processing avatar:', errorText);
            return {success: false, error: `Server error: ${response.status}. ${errorText}`};
        }

        const result = await response.json();
        console.log('Avatar processing result:', result);

        return result;
    } catch (error) {
        console.error('Error in processAvatarWithAWS:', error);
        return {success: false, error: error instanceof Error ? error.message : 'Unknown error'};
    }
};

export const pickAndProcessAvatarWithAWS = async (): Promise<{
    uri: string | undefined;
    base64: string | undefined;
    mlkitProcessed: boolean;
    awsProcessed: boolean;
    canceled: boolean;
    faceAnalysis?: {
        faceCount: number;
        quality: any[];
    };
}> => {
    const result = await pickAndProcessAvatarWithMLKit();
    return {...result, awsProcessed: true};
}

/**
 * Pick an image and process it with AWS Rekognition or fall back to ML Kit processing
 */
export const pickAndProcessAvatarWithMLKit = async (): Promise<{
    uri: string | undefined;
    base64: string | undefined;
    mlkitProcessed: boolean;
    awsProcessed: boolean;
    canceled: boolean;
    faceAnalysis?: {
        faceCount: number;
        quality: any[];
    };
}> => {
    try {
        const pickerResult = await pickImage();

        if (pickerResult.canceled || !pickerResult.assets || !pickerResult.assets[0]) {
            return {
                uri: undefined,
                base64: undefined,
                mlkitProcessed: false,
                awsProcessed: false,
                canceled: true
            };
        }

        const originalUri = pickerResult.assets[0].uri;
        const originalBase64 = pickerResult.assets[0].base64 || undefined;
        const fileName = originalUri.split('/').pop() || `image_${Date.now()}.jpg`;
        const tempPlayerId = `temp_${Date.now()}`;

        // Try AWS processing first for web
        if (Platform.OS === 'web') {
            try {
                const processResult = await processAvatarWithAWS(originalBase64, fileName, tempPlayerId);

                if (processResult.success && processResult.url) {
                    return {
                        uri: processResult.url,
                        base64: originalBase64,
                        mlkitProcessed: false,
                        awsProcessed: true,
                        canceled: false
                    };
                }
            } catch (error) {
                console.log('AWS processing failed, falling back to ML Kit processing:', error);
            }
        }

        console.log('Using ML Kit face detection for local processing');

        // Analyze face first for debugging
        const faceAnalysis = await analyzeFaceInImage(originalUri);
        console.log('Face analysis result:', faceAnalysis);

        // Process with ML Kit
        const processedUri = await detectFaceAndCrop(originalUri);

        // If ML Kit processing changed the URI, update base64
        let finalBase64 = originalBase64;
        if (processedUri !== originalUri && originalBase64) {
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
            mlkitProcessed: processedUri !== originalUri,
            awsProcessed: false,
            canceled: false,
            faceAnalysis: {
                faceCount: faceAnalysis.faceCount,
                quality: faceAnalysis.quality
            }
        };
    } catch (error) {
        console.error('Error in pickAndProcessAvatarWithMLKit:', error);
        return {
            uri: undefined,
            base64: undefined,
            mlkitProcessed: false,
            awsProcessed: false,
            canceled: true
        };
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

        const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const validExt = ['jpg', 'jpeg', 'png', 'gif'].includes(fileExt) ? fileExt : 'jpg';
        const fileName = `${playerId}_${Date.now()}.${validExt}`;

        const contentType = `image/${validExt === 'jpg' ? 'jpeg' : validExt}`;
        const arrayBuffer = decode(base64Data);

        console.log('Uploading image to Supabase bucket: avatars');

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

        const {data: {publicUrl}} = supabase.storage.from('avatars').getPublicUrl(fileName);
        console.log('Image uploaded successfully, public URL:', publicUrl);

        return {url: publicUrl, error: undefined};
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during upload';
        console.error('Avatar upload failed:', errorMessage);
        return {url: undefined, error: errorMessage};
    }
};

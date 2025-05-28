// Improved Edge Function with better error handling and debugging
import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Lista dozwolonych originów dla CORS
const allowedOrigins = [
    'https://j7uiqbc-mosinacity-8082.exp.direct', // URL Expo
    'http://localhost:8081',
    'http://localhost:19006',
    'capacitor://localhost',
    'http://localhost',
    '*' // Tymczasowo zezwalaj na wszystkie źródła podczas rozwoju
]

// Funkcja pomocnicza do dodawania nagłówków CORS
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Zezwól na wszystkie źródła
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Client-Info'
}

// Konfiguracja AWS
const awsConfig = {
    region: Deno.env.get('AWS_REGION') || 'eu-central-1',
    accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') || '',
    secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') || ''
}

// Funkcja do sprawdzania poprawności base64
function isValidBase64(str: string): boolean {
    try {
        // Check if string is valid base64
        const decoded = atob(str);
        const reencoded = btoa(decoded);
        return reencoded === str;
    } catch {
        return false;
    }
}

// Funkcja do tworzenia podpisu AWS v4
async function createAWSSignature(
    method: string,
    url: string,
    headers: Record<string, string>,
    payload: string,
    service: string,
    region: string
): Promise<string> {
    const encoder = new TextEncoder();

    // Get current date
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

    // Create canonical request
    const canonicalUri = new URL(url).pathname;
    const canonicalQuerystring = '';
    const canonicalHeaders = Object.keys(headers)
        .sort()
        .map(key => `${key.toLowerCase()}:${headers[key]}`)
        .join('\n') + '\n';
    const signedHeaders = Object.keys(headers)
        .sort()
        .map(key => key.toLowerCase())
        .join(';');

    // Hash payload
    const payloadHash = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
    const payloadHashHex = Array.from(new Uint8Array(payloadHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQuerystring,
        canonicalHeaders,
        signedHeaders,
        payloadHashHex
    ].join('\n');

    // Hash canonical request
    const canonicalRequestHash = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
    const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // Create string to sign
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        canonicalRequestHashHex
    ].join('\n');

    // Create signing key
    const kDate = await hmacSHA256(dateStamp, `AWS4${awsConfig.secretAccessKey}`);
    const kRegion = await hmacSHA256(region, kDate);
    const kService = await hmacSHA256(service, kRegion);
    const kSigning = await hmacSHA256('aws4_request', kService);

    // Create signature
    const signature = await hmacSHA256(stringToSign, kSigning);
    const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return `AWS4-HMAC-SHA256 Credential=${awsConfig.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
}

// HMAC-SHA256 helper function
async function hmacSHA256(message: string, key: string | ArrayBuffer): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const keyData = typeof key === 'string' ? encoder.encode(key) : key;
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    return await crypto.subtle.sign('HMAC', cryptoKey, messageData);
}

// Funkcja do wykrywania twarzy za pomocą AWS Rekognition
async function detectFaceWithAWS(imageBase64: string) {
    try {
        console.log('Starting AWS face detection...');
        console.log('Base64 length:', imageBase64.length);

        // Sprawdź czy mamy skonfigurowane klucze AWS
        if (!awsConfig.accessKeyId || !awsConfig.secretAccessKey) {
            console.log('AWS credentials not configured, skipping face detection');
            return {found: false, error: 'AWS credentials not configured'};
        }

        // Validate base64
        if (!isValidBase64(imageBase64)) {
            console.error('Invalid base64 data provided');
            return {found: false, error: 'Invalid base64 data'};
        }

        const endpoint = `https://rekognition.${awsConfig.region}.amazonaws.com/`;
        const service = 'rekognition';

        // Przygotuj payload dla AWS Rekognition
        const payload = JSON.stringify({
            Image: {
                Bytes: imageBase64
            },
            Attributes: ['DEFAULT']
        });

        // Przygotuj nagłówki
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

        const headers = {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'RekognitionService.DetectFaces',
            'X-Amz-Date': amzDate,
            'Host': `rekognition.${awsConfig.region}.amazonaws.com`
        };

        // Utwórz podpis AWS
        headers['Authorization'] = await createAWSSignature(
            'POST',
            endpoint,
            headers,
            payload,
            service,
            awsConfig.region
        );

        console.log('Making request to AWS Rekognition...');

        // Wykonaj żądanie do AWS Rekognition
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: payload
        });

        console.log('AWS Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AWS Rekognition error:', response.status, errorText);
            return {found: false, error: `AWS error: ${response.status} - ${errorText}`};
        }

        const result = await response.json();
        console.log('AWS Rekognition result:', JSON.stringify(result, null, 2));

        // Sprawdź czy znaleziono twarze
        if (result.FaceDetails && result.FaceDetails.length > 0) {
            console.log(`Found ${result.FaceDetails.length} face(s)`);

            // Zwróć informacje o pierwszej twarzy
            const face = result.FaceDetails[0];
            return {
                found: true,
                confidence: face.Confidence,
                boundingBox: face.BoundingBox,
                faceDetails: face
            };
        } else {
            console.log('No faces detected by AWS Rekognition');
            return {found: false};
        }

    } catch (error) {
        console.error('AWS Rekognition error:', error);
        return {found: false, error: error.message};
    }
}

// Funkcja do przetwarzania obrazu
const processImage = async (imageBase64: string, fileName: string, playerId: string) => {
    console.log('Processing image:', {
        fileName,
        playerId,
        base64Length: imageBase64.length
    });

    // Wykryj twarz za pomocą AWS Rekognition
    const faceDetection = await detectFaceWithAWS(imageBase64);

    // Inicjalizacja klienta Supabase
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    try {
        console.log('Converting base64 to binary data...');

        // Konwersja base64 na Uint8Array do przesłania do Supabase
        const binaryData = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
        console.log('Binary data size:', binaryData.length);

        // Wygeneruj unikalną nazwę pliku
        const fileExt = fileName.split('.').pop() || 'jpg';
        const uniqueFileName = `${playerId}_${Date.now()}.${fileExt}`;

        console.log('Uploading to Supabase Storage:', uniqueFileName);

        // Prześlij obraz do Supabase Storage
        const {data, error} = await supabaseClient.storage
            .from('avatars')
            .upload(uniqueFileName, binaryData, {
                contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
                upsert: true
            });

        if (error) {
            console.error('Supabase storage error:', error);
            throw error;
        }

        console.log('Upload successful:', data);

        // Pobierz publiczny URL obrazu
        const {data: {publicUrl}} = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(uniqueFileName);

        console.log('Public URL:', publicUrl);

        return {
            success: true,
            url: publicUrl,
            faceDetected: faceDetection.found,
            confidence: faceDetection.confidence,
            message: faceDetection.found ?
                `Face detected with ${faceDetection.confidence?.toFixed(1)}% confidence` :
                'No face detected, using original image',
            fileName: uniqueFileName,
            awsError: faceDetection.error || null
        };
    } catch (error) {
        console.error('Error processing image:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

serve(async (req) => {
    console.log('Received request:', req.method, req.url);

    // Zawsze dodaj nagłówki CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    try {
        // Tylko żądania POST
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({error: 'Method not allowed'}), {
                status: 405,
                headers: corsHeaders
            });
        }

        // Odczytaj dane z żądania
        const requestBody = await req.json();
        console.log('Request body keys:', Object.keys(requestBody));

        const {imageBase64, fileName, playerId} = requestBody;

        // Sprawdź czy wszystkie wymagane pola są dostępne
        if (!imageBase64 || !fileName || !playerId) {
            console.error('Missing required fields:', {
                imageBase64: !!imageBase64,
                fileName: !!fileName,
                playerId: !!playerId
            });
            return new Response(JSON.stringify({
                error: 'Missing required fields',
                required: ['imageBase64', 'fileName', 'playerId']
            }), {
                status: 400,
                headers: corsHeaders
            });
        }

        // Przetwórz obraz
        const result = await processImage(imageBase64, fileName, playerId);

        console.log('Processing result:', result);

        // Zwróć wynik
        return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 500,
            headers: corsHeaders
        });
    } catch (error) {
        console.error('Unhandled error:', error);
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
});

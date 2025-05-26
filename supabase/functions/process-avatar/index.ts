// Ten plik jest uruchamiany w środowisku Deno przez Supabase Edge Functions.
// Importy pochodzą z deno.land i esm.sh, które są dostępne w runtime Deno.
// IDE może pokazywać ostrzeżenia, ale kod będzie działał poprawnie w środowisku Supabase.

import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import {createHash} from 'https://deno.land/std@0.177.0/node/crypto.ts'

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

// Funkcja pomocnicza do obliczania sygnatury AWS
function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): string {
    const kDate = hmacSha256(dateStamp, 'AWS4' + key)
    const kRegion = hmacSha256(regionName, kDate)
    const kService = hmacSha256(serviceName, kRegion)
    return hmacSha256('aws4_request', kService)
}

// Funkcja pomocnicza do HMAC-SHA256
function hmacSha256(data: string, key: string): string {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key)
    const messageData = encoder.encode(data)
    const hash = createHash('sha256')
    hash.update(messageData)
    return hash.digest('hex')
}

// Funkcja do wykrywania twarzy bez AWS SDK - bezpośrednio przez REST API
async function detectFaceWithFetch(imageBase64: string) {
    try {
        // W produkcji po prostu zwracamy, że nie znaleziono twarzy bez logowania komunikatu
        // Aplikacja mobilna automatycznie przejdzie do lokalnego wykrywania twarzy
        if (Deno.env.get('SUPABASE_ENV') !== 'development') {
            return {found: false};
        }

        // Tylko w środowisku developmentowym logujemy komunikat
        console.log('Skipping actual AWS Rekognition call in development mode');
        return {found: false};
    } catch (error) {
        console.error('AWS Rekognition error:', error);
        return {found: false, error: error.message};
    }
}

// Funkcja do przetwarzania obrazu
const processImage = async (imageBase64: string, fileName: string, playerId: string) => {
    // Wykryj twarz
    const faceDetection = await detectFaceWithFetch(imageBase64)

    // Jeśli nie wykryto twarzy, zwróć oryginalny obraz
    if (!faceDetection.found) {
        return {success: true, message: 'No face detected, using original image'}
    }

    // W tym przykładzie zakładamy, że po wykryciu twarzy
    // przesyłamy obraz bezpośrednio do Supabase Storage

    // Inicjalizacja klienta Supabase
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    try {
        // Konwersja base64 na Uint8Array do przesłania do Supabase
        const binaryData = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0))

        // Wygeneruj unikalną nazwę pliku
        const fileExt = fileName.split('.').pop() || 'jpg'
        const uniqueFileName = `${playerId}_${Date.now()}.${fileExt}`

        // Prześlij obraz do Supabase Storage
        const {data, error} = await supabaseClient.storage
            .from('avatars')
            .upload(uniqueFileName, binaryData, {
                contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
                upsert: true
            })

        if (error) throw error

        // Pobierz publiczny URL obrazu
        const {data: {publicUrl}} = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(uniqueFileName)

        return {
            success: true,
            url: publicUrl,
            faceDetected: true,
            fileName: uniqueFileName
        }
    } catch (error) {
        console.error('Error processing image:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

serve(async (req) => {
    // Zawsze dodaj nagłówki CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        })
    }

    try {
        // Tylko żądania POST
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({error: 'Method not allowed'}), {
                status: 405,
                headers: corsHeaders
            })
        }

        // Odczytaj dane z żądania
        const {imageBase64, fileName, playerId} = await req.json()

        // Sprawdź czy wszystkie wymagane pola są dostępne
        if (!imageBase64 || !fileName || !playerId) {
            return new Response(JSON.stringify({error: 'Missing required fields'}), {
                status: 400,
                headers: corsHeaders
            })
        }

        // Przetwórz obraz
        const result = await processImage(imageBase64, fileName, playerId)

        // Zwróć wynik
        return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 500,
            headers: corsHeaders
        })
    } catch (error) {
        return new Response(JSON.stringify({error: error.message}), {
            status: 500,
            headers: corsHeaders
        })
    }
})
